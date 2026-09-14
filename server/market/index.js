/**
 * Marktdaten-Dienst.
 *
 * Bündelt die tagesaktuellen Quellen hinter einer Schnittstelle und sorgt
 * dafür, dass die Anwendung auch ohne sie vollständig funktioniert. Ohne
 * Konfiguration ist der Dienst still: es geht keine einzige Anfrage nach
 * außen, und der Rechner arbeitet wie bisher mit den eingetragenen Werten.
 *
 * Eingeschaltet wird je Quelle über Umgebungsvariablen:
 *
 *   TANKERKOENIG_API_KEY          Kraftstoffpreise ein (Schlüssel kostenlos)
 *   MARKET_POSTAL_CODE            Vorgaberegion des Betreibers, etwa 10115
 *   MARKET_LAT / MARKET_LNG       alternativ direkt Koordinaten
 *   MARKET_RADIUS_KM              Umkreis der Tankstellensuche, Vorgabe 10
 *   MARKET_POWER                  on schaltet den Börsenstrompreis ein
 *   MARKET_POWER_ZONE             Gebotszone, Vorgabe DE-LU
 *   MARKET_TTL_MINUTES            Gültigkeit eines Werts, Vorgabe 60
 *   MARKET_MIN_INTERVAL_SECONDS   Mindestabstand zweier Abrufe, Vorgabe 300
 *   MARKET_FUEL_ENDPOINT          abweichende Adresse, etwa ein eigener Spiegel
 *   MARKET_POWER_ENDPOINT         desgleichen für den Börsenstrompreis
 */

import { createStore, resolve } from './cache.js';
import { fetchFuelPrices, PROVIDER as FUEL_PROVIDER } from './tankerkoenig.js';
import { fetchSpotPrice, PROVIDER as POWER_PROVIDER } from './energycharts.js';
import { lookupPostalCode, normalisePostalCode } from './plz.js';

const truthy = (value) => ['1', 'on', 'true', 'ja', 'yes'].includes(String(value || '').toLowerCase());
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function createMarketService({
  env = process.env,
  postalTable = { coordinates: {} },
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const apiKey = env.TANKERKOENIG_API_KEY || '';
  const radiusKm = num(env.MARKET_RADIUS_KM, 10);
  const ttlMs = num(env.MARKET_TTL_MINUTES, 60) * 60 * 1000;
  const minIntervalMs = num(env.MARKET_MIN_INTERVAL_SECONDS, 300) * 1000;
  const powerEnabled = truthy(env.MARKET_POWER);
  const powerZone = env.MARKET_POWER_ZONE || 'DE-LU';
  // Abweichende Adressen erlauben einen eigenen Spiegel - und Tests ohne Netz.
  const fuelEndpoint = env.MARKET_FUEL_ENDPOINT || undefined;
  const powerEndpoint = env.MARKET_POWER_ENDPOINT || undefined;

  const defaultLocation =
    lookupPostalCode(postalTable, env.MARKET_POSTAL_CODE) ||
    (Number.isFinite(Number(env.MARKET_LAT)) && Number.isFinite(Number(env.MARKET_LNG))
      ? { postalCode: null, lat: Number(env.MARKET_LAT), lng: Number(env.MARKET_LNG) }
      : null);

  const fuelStore = createStore({ ttlMs, minIntervalMs });
  const powerStore = createStore({ ttlMs, minIntervalMs: 60 * 1000 });

  const fuelEnabled = Boolean(apiKey && defaultLocation);
  const locationKey = (location) =>
    `${location.lat.toFixed(2)},${location.lng.toFixed(2)},${radiusKm}`;

  async function fuelFor(location) {
    return resolve(
      fuelStore,
      locationKey(location),
      () =>
        fetchFuelPrices({
          apiKey,
          lat: location.lat,
          lng: location.lng,
          radiusKm,
          fetchImpl,
          endpoint: fuelEndpoint,
        }),
      { onError: (err) => logger.warn?.(`Kraftstoffpreise nicht abrufbar: ${err.message}`) },
    );
  }

  function describe(result, extra) {
    if (!result) return { available: false };
    return {
      available: true,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      stale: Boolean(result.stale),
      note: result.note || null,
      ...extra(result.value),
    };
  }

  async function marketData({ postalCode } = {}) {
    const notes = [];
    const wanted = normalisePostalCode(postalCode);
    const requested = wanted ? lookupPostalCode(postalTable, wanted) : null;
    if (wanted && !requested) {
      notes.push(`Die Postleitzahl ${wanted} ist nicht bekannt, es gilt die Vorgaberegion.`);
    }

    let location = requested || defaultLocation;
    let regionSource = requested ? 'request' : 'default';

    const payload = {
      configured: { fuel: fuelEnabled, power: powerEnabled },
      region: location
        ? { postalCode: location.postalCode, source: regionSource, radiusKm }
        : null,
      fuel: { available: false },
      power: { available: false },
      notes,
    };

    if (fuelEnabled && location) {
      let result = await fuelFor(location);
      if (!result && requested && defaultLocation) {
        // Regionale Abfrage gerade nicht möglich - die Vorgaberegion liegt
        // meist noch im Zwischenspeicher und ist besser als gar kein Wert.
        result = await fuelFor(defaultLocation);
        if (result) {
          location = defaultLocation;
          regionSource = 'default';
          payload.region = { postalCode: defaultLocation.postalCode, source: 'default', radiusKm };
          notes.push('Für die angefragte Region lag noch kein Abruf vor, gezeigt wird die Vorgaberegion.');
        }
      }
      payload.fuel = {
        ...describe(result, (value) => ({
          prices: value.prices,
          stations: value.stations,
          counts: value.counts,
        })),
        provider: FUEL_PROVIDER,
      };
      if (!result) notes.push('Kraftstoffpreise sind derzeit nicht abrufbar.');
    }

    if (powerEnabled) {
      const result = await resolve(
        powerStore,
        powerZone,
        () => fetchSpotPrice({ zone: powerZone, fetchImpl, endpoint: powerEndpoint }),
        { onError: (err) => logger.warn?.(`Börsenstrompreis nicht abrufbar: ${err.message}`) },
      );
      payload.power = {
        ...describe(result, (value) => ({
          mean: value.mean,
          min: value.min,
          max: value.max,
          day: value.day,
          hours: value.hours,
        })),
        zone: powerZone,
        provider: POWER_PROVIDER,
      };
      if (!result) notes.push('Der Börsenstrompreis ist derzeit nicht abrufbar.');
    }

    return payload;
  }

  return {
    marketData,
    enabled: fuelEnabled || powerEnabled,
    configuration: () => ({
      fuel: fuelEnabled,
      power: powerEnabled,
      radiusKm,
      defaultPostalCode: defaultLocation?.postalCode || null,
      postalLookup: Object.keys(postalTable.coordinates || {}).length > 0,
      ttlMinutes: ttlMs / 60000,
    }),
  };
}
