/**
 * Kraftstoffpreise aus der Tankerkönig-API.
 *
 * Datenbasis ist die Markttransparenzstelle für Kraftstoffe; Tankerkönig gibt
 * sie unter einer OpenData-Lizenz weiter. Der Schlüssel ist kostenlos, der
 * Betrieb ausdrücklich "best effort" - Ausfälle sind einzuplanen, nicht
 * auszuschließen. Namensnennung ist Pflicht und steht im Fußbereich der Seite.
 *
 *   https://creativecommons.tankerkoenig.de/
 *
 * Aus den Tankstellen im Umkreis wird der Median gebildet, nicht der
 * Mittelwert: einzelne Autobahn- oder Werkstattpreise verzerren den Schnitt
 * sonst um mehrere Cent nach oben.
 */

const ENDPOINT = 'https://creativecommons.tankerkoenig.de/json/list.php';
const FUEL_KEYS = ['e5', 'e10', 'diesel'];

export const PROVIDER = {
  name: 'Tankerkönig',
  url: 'https://creativecommons.tankerkoenig.de/',
  licence: 'OpenData, Daten der Markttransparenzstelle für Kraftstoffe',
};

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Ein Preis zählt nur, wenn er eine plausible Zahl ist - die API liefert sonst false. */
function usablePrice(raw) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0.3 && value < 5 ? value : null;
}

/**
 * Wertet die Antwort von list.php aus. Getrennt vom Abruf, damit das Format
 * ohne Netzzugriff geprüft werden kann.
 */
export function parseStationList(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unerwartete Antwort');
  }
  if (payload.ok === false) {
    throw new Error(payload.message || 'Abfrage abgelehnt');
  }
  const stations = Array.isArray(payload.stations) ? payload.stations : [];

  const prices = {};
  const counts = {};
  for (const key of FUEL_KEYS) {
    const values = stations
      .map((station) => usablePrice(station[key]))
      .filter((value) => value !== null);
    prices[key] = values.length ? Number(median(values).toFixed(3)) : null;
    counts[key] = values.length;
  }

  return {
    prices,
    counts,
    stations: stations.length,
    licence: typeof payload.license === 'string' ? payload.license : null,
  };
}

export async function fetchFuelPrices({
  apiKey,
  lat,
  lng,
  radiusKm = 10,
  fetchImpl = fetch,
  timeoutMs = 8000,
  endpoint = ENDPOINT,
}) {
  if (!apiKey) throw new Error('Kein API-Schlüssel hinterlegt');

  const url = new URL(endpoint);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  // Die API deckelt den Radius bei 25 km.
  url.searchParams.set('rad', String(Math.min(Math.max(Number(radiusKm) || 10, 1), 25)));
  url.searchParams.set('sort', 'dist');
  url.searchParams.set('type', 'all');
  url.searchParams.set('apikey', apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseStationList(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
