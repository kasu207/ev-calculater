/**
 * Prüfregeln für einen Fahrzeugdatensatz.
 *
 * Dieselben Regeln gelten an drei Stellen: im Test für die mitgelieferten
 * Daten, beim Einlesen einer externen Datei und beim nächtlichen Abzug aus
 * einem Lizenzfeed. Eine kaputte Lieferung darf den Dienst nicht vergiften -
 * sie wird abgewiesen, und es bleibt beim letzten guten Stand.
 *
 * Die Querprobe zwischen Reichweite, Batterie und Verbrauch fängt genau die
 * Tippfehler, die beim Übertragen von Hand entstehen und im Ranking sonst
 * unbemerkt wirken. Das Fenster ist weit gefasst, weil der Verbrauch hier den
 * Ladeverlust enthält, die WLTP-Reichweite aber nicht.
 */

import { BODY_LABELS } from './vehicles.js';

const NUMBER_RANGES = {
  price: [5000, 250000],
  batteryKwh: [10, 250],
  rangeKm: [100, 1000],
  consumptionKwh100: [8, 40],
  dcPeakKw: [10, 400],
  acPeakKw: [1, 50],
  seats: [2, 9],
  bootLiters: [0, 2000],
  towing: [0, 3000],
  warrantyBatteryYears: [1, 15],
};

const RANGE_WINDOW = [-0.15, 0.4];

export function validateVehicle(vehicle) {
  const errors = [];
  const label = vehicle?.id || '(ohne id)';

  if (typeof vehicle?.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(vehicle.id)) {
    errors.push(`${label}: id fehlt oder enthält ungültige Zeichen`);
  }
  for (const key of ['brand', 'model', 'note']) {
    if (typeof vehicle?.[key] !== 'string' || vehicle[key].trim().length < 2) {
      errors.push(`${label}: ${key} fehlt`);
    }
  }
  if (typeof vehicle?.note === 'string' && vehicle.note.trim().length < 10) {
    errors.push(`${label}: note ist zu kurz für die Anzeige`);
  }
  if (!Object.hasOwn(BODY_LABELS, vehicle?.body)) {
    errors.push(`${label}: body "${vehicle?.body}" ist keine bekannte Karosserieform`);
  }

  for (const [key, [min, max]] of Object.entries(NUMBER_RANGES)) {
    const value = Number(vehicle?.[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      errors.push(`${label}: ${key} liegt mit "${vehicle?.[key]}" außerhalb von ${min} bis ${max}`);
    }
  }

  const battery = Number(vehicle?.batteryKwh);
  const consumption = Number(vehicle?.consumptionKwh100);
  const range = Number(vehicle?.rangeKm);
  if (Number.isFinite(battery) && Number.isFinite(consumption) && consumption > 0 && Number.isFinite(range)) {
    const computed = (battery / consumption) * 100;
    const deviation = range / computed - 1;
    if (deviation < RANGE_WINDOW[0] || deviation > RANGE_WINDOW[1]) {
      errors.push(
        `${label}: Reichweite ${range} km passt nicht zu ${battery} kWh und ${consumption} kWh/100 km ` +
          `(rechnerisch ${Math.round(computed)} km, Abweichung ${Math.round(deviation * 100)} Prozent)`,
      );
    }
  }

  return errors;
}

export function validateVehicleList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, errors: ['Keine Fahrzeugliste erhalten'], count: 0 };
  }

  const errors = [];
  const ids = new Set();
  for (const vehicle of list) {
    errors.push(...validateVehicle(vehicle));
    if (typeof vehicle?.id === 'string') {
      if (ids.has(vehicle.id)) errors.push(`${vehicle.id}: doppelte id`);
      ids.add(vehicle.id);
    }
  }

  return { ok: errors.length === 0, errors, count: list.length };
}
