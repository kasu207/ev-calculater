/**
 * Herkunft der Fahrzeugdaten.
 *
 * Der Rechner fragt immer dieselbe Schnittstelle, egal woher die Daten
 * stammen. Drei Quellen sind vorgesehen:
 *
 *   snapshot - die im Repository gepflegten Richtwerte. Immer vorhanden,
 *              immer der Rückfall.
 *   file     - eine JSON-Datei auf dem Server, etwa als Docker-Volume
 *              eingehängt. Preiskorrektur ohne neues Abbild.
 *   feed     - ein nächtlicher Vollabzug über HTTP, wie ihn Anbieter mit
 *              Lizenzvertrag bereitstellen (EV Database Data Services und
 *              vergleichbare). Nur Konfiguration, kein Umbau.
 *
 * Jede externe Lieferung wird vor der Übernahme geprüft. Fällt sie durch,
 * bleibt der zuletzt gültige Stand aktiv und der Grund steht im Protokoll.
 */

import fs from 'node:fs/promises';

import { vehicles as snapshot, DATA_VINTAGE } from '../../shared/vehicles.js';
import { validateVehicleList } from '../../shared/vehicle-schema.js';

function extractList(payload) {
  if (Array.isArray(payload)) return { list: payload, vintage: null };
  if (Array.isArray(payload?.vehicles)) {
    return { list: payload.vehicles, vintage: payload.dataVintage || payload.vintage || null };
  }
  return { list: null, vintage: null };
}

export async function loadFromFile(path) {
  const { list, vintage } = extractList(JSON.parse(await fs.readFile(path, 'utf8')));
  const check = validateVehicleList(list);
  if (!check.ok) throw new Error(check.errors.slice(0, 3).join('; '));
  return { list, vintage };
}

export async function loadFromFeed(url, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { list, vintage } = extractList(await res.json());
    const check = validateVehicleList(list);
    if (!check.ok) throw new Error(check.errors.slice(0, 3).join('; '));
    return { list, vintage };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hält den aktiven Datensatz. `refresh` ist absichtlich fehlertolerant: ein
 * misslungener Abzug ändert nichts am laufenden Betrieb.
 */
export function createVehicleStore({ file = null, url = null, fetchImpl = fetch, logger = console } = {}) {
  let active = {
    list: snapshot,
    source: 'snapshot',
    vintage: DATA_VINTAGE,
    loadedAt: new Date().toISOString(),
    fallback: false,
    error: null,
  };

  async function refresh() {
    if (!file && !url) return active;
    try {
      const { list, vintage } = file ? await loadFromFile(file) : await loadFromFeed(url, { fetchImpl });
      active = {
        list,
        source: file ? 'file' : 'feed',
        vintage: vintage || `Externe Quelle, geladen ${new Date().toISOString().slice(0, 10)}`,
        loadedAt: new Date().toISOString(),
        fallback: false,
        error: null,
      };
      logger.log?.(`Fahrzeugdaten übernommen: ${list.length} Einträge aus ${file ? 'Datei' : 'Feed'}`);
    } catch (err) {
      active = { ...active, fallback: true, error: err.message };
      logger.warn?.(`Fahrzeugdaten nicht übernommen (${err.message}) - es gilt der bisherige Stand`);
    }
    return active;
  }

  return {
    refresh,
    list: () => active.list,
    byId: (id) => active.list.find((vehicle) => vehicle.id === id) || null,
    meta: () => ({
      source: active.source,
      vintage: active.vintage,
      loadedAt: active.loadedAt,
      count: active.list.length,
      fallback: active.fallback,
      error: active.error,
    }),
  };
}
