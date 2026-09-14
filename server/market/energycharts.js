/**
 * Börsenstrompreis (Day-Ahead) von Energy-Charts des Fraunhofer ISE.
 *
 *   https://api.energy-charts.info/price?bzn=DE-LU
 *
 * Die Antwort führt zwei gleich lange Felder: unix_seconds und price in
 * EUR/MWh. Verwendet wird das Tagesmittel des laufenden Tages, umgerechnet in
 * EUR/kWh.
 *
 * Wichtig für die Einordnung in der Oberfläche: das ist der Börsenpreis, nicht
 * der Haushaltstarif. Für Festpreisverträge ist er kein Ersatz für den
 * eingetragenen Wert, sondern nur ein Anhaltspunkt - bei dynamischen Tarifen
 * dagegen die eigentliche Bezugsgröße.
 */

const ENDPOINT = 'https://api.energy-charts.info/price';

export const PROVIDER = {
  name: 'Energy-Charts, Fraunhofer ISE',
  url: 'https://www.energy-charts.info/',
  licence: 'CC BY 4.0',
};

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Tagesdatum in deutscher Zeitzone, Format 2026-09-14. */
export function dayInBerlin(unixSeconds) {
  return berlinDate.format(new Date(unixSeconds * 1000));
}

/**
 * Rechnet die Antwort auf Kennzahlen des laufenden Tages herunter. Liegen für
 * heute keine Werte vor - etwa kurz nach Mitternacht -, zählt der gesamte
 * gelieferte Zeitraum.
 */
export function parseSpotPrices(payload, { today = dayInBerlin(Date.now() / 1000) } = {}) {
  const seconds = Array.isArray(payload?.unix_seconds) ? payload.unix_seconds : [];
  const prices = Array.isArray(payload?.price) ? payload.price : [];
  if (!seconds.length || seconds.length !== prices.length) {
    throw new Error('Unerwartete Antwort');
  }

  const pairs = seconds
    .map((unix, index) => ({ unix, eurPerMwh: Number(prices[index]) }))
    .filter((pair) => Number.isFinite(pair.eurPerMwh));
  if (!pairs.length) throw new Error('Keine verwertbaren Preise');

  const ofToday = pairs.filter((pair) => dayInBerlin(pair.unix) === today);
  const used = ofToday.length ? ofToday : pairs;
  const perKwh = used.map((pair) => pair.eurPerMwh / 1000);

  return {
    day: ofToday.length ? today : dayInBerlin(used[0].unix),
    mean: Number((perKwh.reduce((sum, v) => sum + v, 0) / perKwh.length).toFixed(4)),
    min: Number(Math.min(...perKwh).toFixed(4)),
    max: Number(Math.max(...perKwh).toFixed(4)),
    hours: perKwh.length,
    partialDay: !ofToday.length,
  };
}

export async function fetchSpotPrice({
  zone = 'DE-LU',
  fetchImpl = fetch,
  timeoutMs = 8000,
  endpoint = ENDPOINT,
} = {}) {
  const url = new URL(endpoint);
  url.searchParams.set('bzn', zone);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSpotPrices(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
