import { describe, expect, it } from 'vitest';
import { STANDARD_ANNAHMEN } from '../src/annahmen';
import {
  empfehlen,
  empfehlenAus,
  jahreskostenElektrisch,
  vergleichen,
} from '../src/berechnung';
import { fahrzeuge, guenstigstesFahrzeug, referenzNachId } from '../src/daten';
import type { Annahmen, Fahrzeug, Referenz } from '../src/schema';

const referenz: Referenz = {
  id: 'ref-benzin',
  marke: 'Muster',
  modell: 'Benziner',
  listenpreisEur: 30000,
  verbrauchLPro100km: 6,
  kraftstoff: 'benzin',
  kfzSteuerEurProJahr: 100,
  quelle: 'Testdaten',
  standDatum: '2026-01-01',
};

function fahrzeug(ueberschreibung: Partial<Fahrzeug> = {}): Fahrzeug {
  return {
    id: 'muster-e',
    marke: 'Muster',
    modell: 'Elektro',
    variante: 'Basis',
    listenpreisEur: 36000,
    verbrauchKwhPro100km: 16,
    kfzSteuerEurProJahr: 0,
    thgQuoteEurProJahr: 70,
    vergleichsId: 'ref-benzin',
    partnerUrl: 'https://www.carwow.de/muster/elektro',
    partnerUrlGeprueft: false,
    quelle: 'Testdaten',
    standDatum: '2026-01-01',
    ...ueberschreibung,
  };
}

const annahmen: Annahmen = { ...STANDARD_ANNAHMEN };

describe('vergleichen', () => {
  it('startet im Jahr 0 mit den reinen Listenpreisen', () => {
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 15000, budgetEur: 50000 }, annahmen);
    expect(v.jahresreihe[0]).toEqual({
      jahr: 0,
      kumuliertElektrisch: 36000,
      kumuliertVerbrenner: 30000,
    });
  });

  it('liefert eine Reihe ueber die volle Haltedauer', () => {
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 15000, budgetEur: 50000 }, annahmen);
    expect(v.jahresreihe).toHaveLength(annahmen.haltedauerJahre + 1);
    expect(v.jahresreihe.at(-1)?.jahr).toBe(annahmen.haltedauerJahre);
  });

  it('rundet jeden Wert auf ganze Euro', () => {
    const v = vergleichen(
      fahrzeug({ listenpreisEur: 36000, verbrauchKwhPro100km: 17.3 }),
      referenz,
      { kmProJahr: 13333, budgetEur: 50000 },
      annahmen,
    );
    for (const punkt of v.jahresreihe) {
      expect(Number.isInteger(punkt.kumuliertElektrisch)).toBe(true);
      expect(Number.isInteger(punkt.kumuliertVerbrenner)).toBe(true);
    }
    expect(Number.isInteger(v.differenzGesamtEur)).toBe(true);
  });

  it('rechnet ohne Fahrleistung nur Anschaffung, Steuer und THG-Quote', () => {
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 0, budgetEur: 50000 }, annahmen);
    // 6 Jahre: Verbrenner 100 Euro Steuer, elektrisch 70 Euro Gutschrift.
    expect(v.jahresreihe.at(-1)).toEqual({
      jahr: 6,
      kumuliertElektrisch: 36000 - 6 * 70,
      kumuliertVerbrenner: 30000 + 6 * 100,
    });
    expect(v.breakEvenJahr).toBeNull();
    expect(v.differenzGesamtEur).toBe(30600 - 35580);
  });

  it('meldet keinen Break-even, wenn er ausserhalb der Haltedauer liegt', () => {
    const v = vergleichen(
      fahrzeug({ listenpreisEur: 44000 }),
      referenz,
      { kmProJahr: 5000, budgetEur: 50000 },
      annahmen,
    );
    expect(v.breakEvenJahr).toBeNull();
    expect(v.differenzGesamtEur).toBeLessThan(0);
  });

  it('meldet Break-even im Jahr 0, wenn das Elektroauto schon beim Kauf guenstiger ist', () => {
    const v = vergleichen(
      fahrzeug({ listenpreisEur: 25000 }),
      referenz,
      { kmProJahr: 15000, budgetEur: 50000 },
      annahmen,
    );
    expect(v.breakEvenJahr).toBe(0);
  });

  it('findet das kleinste Jahr ohne Mehrkosten', () => {
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 30000, budgetEur: 50000 }, annahmen);
    const jahr = v.breakEvenJahr;
    expect(jahr).not.toBeNull();
    const punkt = v.jahresreihe[jahr!]!;
    expect(punkt.kumuliertElektrisch).toBeLessThanOrEqual(punkt.kumuliertVerbrenner);
    if (jahr! > 0) {
      const davor = v.jahresreihe[jahr! - 1]!;
      expect(davor.kumuliertElektrisch).toBeGreaterThan(davor.kumuliertVerbrenner);
    }
  });
});

describe('empfehlenAus', () => {
  const eingabe = { kmProJahr: 15000, budgetEur: 40000 };

  it('waehlt die hoechste Gesamtdifferenz im Budget', () => {
    const sparsam = fahrzeug({ id: 'sparsam', verbrauchKwhPro100km: 13 });
    const durstig = fahrzeug({ id: 'durstig', verbrauchKwhPro100km: 20 });
    const ergebnis = empfehlenAus([durstig, sparsam], [referenz], eingabe, annahmen);
    expect(ergebnis?.modellId).toBe('sparsam');
  });

  it('ignoriert Fahrzeuge ueber dem Budget', () => {
    const teuer = fahrzeug({ id: 'teuer', listenpreisEur: 41000, verbrauchKwhPro100km: 12 });
    const bezahlbar = fahrzeug({ id: 'bezahlbar', listenpreisEur: 39000 });
    const ergebnis = empfehlenAus([teuer, bezahlbar], [referenz], eingabe, annahmen);
    expect(ergebnis?.modellId).toBe('bezahlbar');
  });

  it('gibt null zurueck, wenn das Budget unter dem guenstigsten Modell liegt', () => {
    const ergebnis = empfehlenAus([fahrzeug()], [referenz], { kmProJahr: 15000, budgetEur: 10000 }, annahmen);
    expect(ergebnis).toBeNull();
  });

  it('entscheidet den Gleichstand ueber den frueheren Break-even', () => {
    // Beide Modelle haben dieselbe Gesamtdifferenz: das sparsamere kostet in der
    // Anschaffung genau so viel mehr, wie es ueber sechs Jahre zusaetzlich spart.
    const vielfahrer = { kmProJahr: 30000, budgetEur: 60000 };
    const guenstigeReferenz: Referenz = { ...referenz, listenpreisEur: 30000 };

    const frueh = fahrzeug({ id: 'a-frueh', listenpreisEur: 36000, verbrauchKwhPro100km: 16 });
    const mehrErsparnisProJahr =
      jahreskostenElektrisch(frueh, vielfahrer.kmProJahr, annahmen) -
      jahreskostenElektrisch(fahrzeug({ verbrauchKwhPro100km: 8 }), vielfahrer.kmProJahr, annahmen);
    const spaet = fahrzeug({
      id: 'b-spaet',
      listenpreisEur: 36000 + annahmen.haltedauerJahre * mehrErsparnisProJahr,
      verbrauchKwhPro100km: 8,
    });

    const a = vergleichen(frueh, guenstigeReferenz, vielfahrer, annahmen);
    const b = vergleichen(spaet, guenstigeReferenz, vielfahrer, annahmen);
    expect(a.differenzGesamtEur).toBe(b.differenzGesamtEur);
    expect(a.breakEvenJahr).not.toBeNull();
    expect(b.breakEvenJahr).not.toBeNull();
    expect(a.breakEvenJahr!).toBeLessThan(b.breakEvenJahr!);

    const ergebnis = empfehlenAus([spaet, frueh], [guenstigeReferenz], vielfahrer, annahmen);
    expect(ergebnis?.modellId).toBe('a-frueh');
  });

  it('entscheidet den vollstaendigen Gleichstand ueber die Id, damit das Ergebnis stabil bleibt', () => {
    const zwei = fahrzeug({ id: 'zwei' });
    const eins = fahrzeug({ id: 'eins' });
    expect(empfehlenAus([zwei, eins], [referenz], eingabe, annahmen)?.modellId).toBe('eins');
    expect(empfehlenAus([eins, zwei], [referenz], eingabe, annahmen)?.modellId).toBe('eins');
  });

  it('ueberspringt Fahrzeuge ohne passende Referenz', () => {
    const ohne = fahrzeug({ id: 'ohne', vergleichsId: 'gibt-es-nicht' });
    expect(empfehlenAus([ohne], [referenz], eingabe, annahmen)).toBeNull();
  });

  it('weist ungueltige Eingaben zurueck', () => {
    const ungueltig = [
      { kmProJahr: -1, budgetEur: 40000 },
      { kmProJahr: 15000, budgetEur: -40000 },
      { kmProJahr: Number.NaN, budgetEur: 40000 },
      { kmProJahr: 15000, budgetEur: Number.POSITIVE_INFINITY },
      { kmProJahr: 15000.5, budgetEur: 40000 },
      { kmProJahr: '15000' as unknown as number, budgetEur: 40000 },
    ];
    for (const eingabe of ungueltig) {
      expect(empfehlenAus([fahrzeug()], [referenz], eingabe, annahmen)).toBeNull();
    }
  });

  it('weist ungueltige Annahmen zurueck', () => {
    expect(
      empfehlenAus([fahrzeug()], [referenz], eingabe, { ...annahmen, haltedauerJahre: 0 }),
    ).toBeNull();
    expect(
      empfehlenAus([fahrzeug()], [referenz], eingabe, { ...annahmen, heimladeAnteil: 1.5 }),
    ).toBeNull();
  });
});

describe('empfehlen mit dem ausgelieferten Datensatz', () => {
  it('liefert fuer die Vorbelegung ein Ergebnis', () => {
    const ergebnis = empfehlen({ kmProJahr: 15000, budgetEur: 45000 });
    expect(ergebnis).not.toBeNull();
    expect(fahrzeuge.some((f) => f.id === ergebnis!.modellId)).toBe(true);
    expect(referenzNachId(ergebnis!.vergleichsId)).toBeDefined();
  });

  it('gibt null zurueck, wenn das Budget unter dem guenstigsten Modell liegt', () => {
    const budget = guenstigstesFahrzeug().listenpreisEur - 1;
    expect(empfehlen({ kmProJahr: 15000, budgetEur: budget })).toBeNull();
  });

  it('gibt die verwendeten Annahmen mit zurueck', () => {
    const ergebnis = empfehlen({ kmProJahr: 15000, budgetEur: 45000 });
    expect(ergebnis?.annahmen).toEqual(STANDARD_ANNAHMEN);
  });
});
