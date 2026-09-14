/**
 * Minimaler HTTP-Server ohne externe Abhängigkeiten.
 * Liefert das Frontend aus /public und stellt die Rechen-API bereit.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaults, withDefaults } from '../shared/defaults.js';
import { BODY_LABELS } from '../shared/vehicles.js';
import { compareVehicle } from '../shared/calc.js';
import { recommend, evaluateVehicle } from '../shared/match.js';
import { buildOffers, buildInquiryText } from '../shared/offers.js';
import { createVehicleStore } from './market/vehicles.js';
import { createMarketService } from './market/index.js';
import { loadPostalTable } from './market/plz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 256 * 1024;
const POSTAL_TABLE_FILE = path.join(ROOT, 'data', 'plz-koordinaten.json');
const VEHICLE_REFRESH_HOURS = Number(process.env.VEHICLES_REFRESH_HOURS) || 24;

/**
 * Datenquellen. Beide folgen demselben Muster: es gibt immer einen gültigen
 * Stand im Prozess, externe Quellen verbessern ihn nur. Fällt eine aus,
 * rechnet die Anwendung weiter und sagt, mit welchem Stand.
 */
const vehicleStore = createVehicleStore({
  file: process.env.VEHICLES_FILE || null,
  url: process.env.VEHICLES_URL || null,
});

const marketReady = (async () => {
  const postalTable = await loadPostalTable(POSTAL_TABLE_FILE);
  return createMarketService({ postalTable });
})();

const dataReady = vehicleStore.refresh();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Anfrage zu groß'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Ungültiges JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** Verdichtet ein Bewertungsergebnis auf das, was das Frontend braucht. */
function serializeEvaluation(result) {
  return {
    vehicle: result.vehicle,
    label: result.label,
    score: result.score,
    parts: result.parts,
    eligible: result.eligible,
    blockers: result.blockers,
    warnings: result.warnings,
    highlights: result.highlights,
    realRangeKm: result.realRangeKm,
    fastChargeMinutes: result.fastChargeMinutes,
    comparison: result.comparison,
  };
}

const routes = {
  /**
   * Lebenszeichen für Container-Healthchecks und Reverse Proxies.
   * Bewusst billig: keine Berechnung, nur ein Beleg, dass der Prozess
   * Anfragen beantwortet und die Fahrzeugdaten geladen sind.
   */
  'GET /api/health': async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    vehicleCount: vehicleStore.list().length,
  }),

  'GET /api/meta': async () => {
    const market = await marketReady;
    const meta = vehicleStore.meta();
    return {
      defaults,
      bodyLabels: BODY_LABELS,
      dataVintage: meta.vintage,
      vehicleCount: meta.count,
      vehicleSource: { source: meta.source, loadedAt: meta.loadedAt, fallback: meta.fallback },
      market: market.configuration(),
    };
  },

  /**
   * Tagesaktuelle Marktdaten. Ohne konfigurierte Quelle antwortet der
   * Endpunkt mit `configured: false` - das Frontend zeigt dann keine
   * Herkunftszeilen an und nichts wird vorbelegt.
   */
  'GET /api/market': async (_body, url) => {
    const market = await marketReady;
    return market.marketData({ postalCode: url?.searchParams.get('plz') });
  },

  'GET /api/vehicles': async () => ({ vehicles: vehicleStore.list(), bodyLabels: BODY_LABELS }),

  'POST /api/recommend': async (body) => {
    const input = withDefaults(body.input || {});
    const list = vehicleStore.list();
    const limit = Math.min(Math.max(Number(body.limit) || 6, 1), list.length);
    const result = recommend(input, list);

    // Das jeweils andere Szenario wird mitgerechnet, damit das Frontend den
    // Unterschied zwischen "behalten" und "ohnehin neu kaufen" zeigen kann.
    const otherScenario = input.scenario === 'replace' ? 'keep' : 'replace';
    const counterInput = withDefaults({ ...input, scenario: otherScenario });
    const counterBest = result.bestMatch
      ? compareVehicle(counterInput, result.bestMatch.vehicle)
      : null;

    return {
      scenario: input.scenario,
      requiredRangeKm: result.requiredRangeKm,
      bestMatch: result.bestMatch ? serializeEvaluation(result.bestMatch) : null,
      bestEconomy: result.bestEconomy ? serializeEvaluation(result.bestEconomy) : null,
      cheapestRunning: result.cheapestRunning ? serializeEvaluation(result.cheapestRunning) : null,
      ranked: result.ranked.slice(0, limit).map(serializeEvaluation),
      rejected: result.rejected.slice(0, 5).map((r) => ({
        label: r.label,
        price: r.vehicle.price,
        blockers: r.blockers,
      })),
      counterScenario: counterBest
        ? {
            scenario: otherScenario,
            vehicleId: counterBest.vehicleId,
            years: counterBest.years,
            breakEvenMonths: counterBest.breakEvenMonths,
            breakEvenYears: counterBest.breakEvenYears,
            totalAdvantage: counterBest.totalAdvantage,
          }
        : null,
    };
  },

  'POST /api/vehicle': async (body) => {
    const vehicle = vehicleStore.byId(body.vehicleId);
    if (!vehicle) throw Object.assign(new Error('Fahrzeug unbekannt'), { status: 404 });
    const input = withDefaults(body.input || {});
    const evaluation = evaluateVehicle(input, vehicle);
    return {
      evaluation: serializeEvaluation(evaluation),
      offers: buildOffers(input, vehicle, evaluation.comparison, body.offerOptions || {}),
      inquiryText: buildInquiryText(input, evaluation),
    };
  },
};

async function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, rel);
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const key = `${req.method} ${url.pathname}`;

  if (url.pathname.startsWith('/api/')) {
    const handler = routes[key];
    if (!handler) return sendJson(res, 404, { error: 'Unbekannter Endpunkt' });
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      sendJson(res, 200, await handler(body, url));
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      sendJson(res, status, { error: err.message || 'Serverfehler' });
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }
  await serveStatic(req, res, url.pathname);
});

/**
 * Geordnetes Herunterfahren. Ohne das würde der Prozess im Container das
 * SIGTERM von `docker compose down` ignorieren und erst nach dem Timeout
 * hart abgeräumt - das kostet bei jedem Neustart unnötig Sekunden.
 */
export function shutdown(signal) {
  console.log(`${signal} empfangen, Server wird beendet.`);
  server.close(() => process.exit(0));
  // Notbremse, falls eine Verbindung nicht freigibt.
  setTimeout(() => process.exit(0), 10000).unref();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await dataReady;
  const market = await marketReady;
  server.listen(PORT, HOST, () => {
    const meta = vehicleStore.meta();
    console.log(`E-Auto-Rechner läuft auf http://${HOST}:${PORT}`);
    console.log(`Fahrzeugdaten: ${meta.count} Modelle aus Quelle "${meta.source}"`);
    const config = market.configuration();
    console.log(
      `Marktdaten: Kraftstoff ${config.fuel ? `ein (${config.defaultPostalCode || 'Koordinaten'}, ${config.radiusKm} km)` : 'aus'}, ` +
        `Börsenstrom ${config.power ? 'ein' : 'aus'}`,
    );
  });

  // Externe Fahrzeugquellen werden regelmäßig neu geholt. Ohne konfigurierte
  // Quelle ist refresh() ein Nichtstuer.
  if (process.env.VEHICLES_FILE || process.env.VEHICLES_URL) {
    setInterval(() => vehicleStore.refresh(), VEHICLE_REFRESH_HOURS * 3600 * 1000).unref();
  }
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => shutdown(signal));
  }
}
