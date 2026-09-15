import { describe, expect, it } from 'vitest';
import fahrzeugeRoh from '../src/daten/fahrzeuge.json';
import referenzenRoh from '../src/daten/referenz.json';
import { FahrzeugListeSchema, ReferenzListeSchema } from '../src/schema';

const fahrzeuge = FahrzeugListeSchema.parse(fahrzeugeRoh);
const referenzen = ReferenzListeSchema.parse(referenzenRoh);

describe('Fahrzeugdatensatz', () => {
  it('validiert gegen das Schema', () => {
    expect(FahrzeugListeSchema.safeParse(fahrzeugeRoh).success).toBe(true);
    expect(ReferenzListeSchema.safeParse(referenzenRoh).success).toBe(true);
  });

  it('enthaelt keine doppelten Ids', () => {
    expect(new Set(fahrzeuge.map((f) => f.id)).size).toBe(fahrzeuge.length);
    expect(new Set(referenzen.map((r) => r.id)).size).toBe(referenzen.length);
  });

  it('verweist mit jeder vergleichsId auf eine vorhandene Referenz', () => {
    const ids = new Set(referenzen.map((r) => r.id));
    for (const f of fahrzeuge) {
      expect(ids.has(f.vergleichsId), `${f.id} zeigt auf ${f.vergleichsId}`).toBe(true);
    }
  });

  it('fuehrt keine Referenz mit, die kein Fahrzeug benutzt', () => {
    const benutzt = new Set(fahrzeuge.map((f) => f.vergleichsId));
    for (const r of referenzen) {
      expect(benutzt.has(r.id), `${r.id} wird von keinem Fahrzeug benutzt`).toBe(true);
    }
  });

  it('hat fuer jedes Modell eine Partnerseite bei Carwow', () => {
    for (const f of fahrzeuge) {
      const url = new URL(f.partnerUrl);
      expect(url.protocol, f.id).toBe('https:');
      expect(url.hostname, f.id).toBe('www.carwow.de');
      expect(url.pathname.length, f.id).toBeGreaterThan(1);
    }
  });

  it('nennt zu jedem Datensatz Quelle und Stand', () => {
    for (const eintrag of [...fahrzeuge, ...referenzen]) {
      expect(eintrag.quelle.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(eintrag.standDatum))).toBe(false);
    }
  });
});
