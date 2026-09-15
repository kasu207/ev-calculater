import { describe, expect, it } from 'vitest';
import { STANDARD_ANNAHMEN } from '../src/annahmen';
import {
  empfehlen,
  empfehlenAus,
  jahreskostenElektrisch,
  restwert,
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

/**
 * Manche Faelle brauchen einen Zeitraum, in dem der Break-even ueberhaupt
 * liegen kann. Sie setzen die Haltedauer selbst, damit sie nicht kippen, wenn
 * die Standardannahme sich aendert.
 */
const langerZeitraum: Annahmen = { ...STANDARD_ANNAHMEN, haltedauerJahre: 8 };

describe('vergleichen', () => {
  it('startet im Jahr 0 auf beiden Seiten bei null', () => {
    // Im Kaufzeitpunkt ist noch nichts verloren: gezahlt ist der Listenpreis,
    // dafuer steht ein Auto in derselben Hoehe da.
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 15000, budgetEur: 50000 }, annahmen);
    expect(v.jahresreihe[0]).toEqual({
      jahr: 0,
      kumuliertElektrisch: 0,
      kumuliertVerbrenner: 0,
    });
  });

  it('rechnet den Wertverlust geometrisch auf den verbliebenen Wert', () => {
    expect(restwert(30000, 0.2, 0)).toBe(30000);
    expect(restwert(30000, 0.2, 1)).toBeCloseTo(24000, 6);
    expect(restwert(30000, 0.2, 2)).toBeCloseTo(19200, 6);
    // Linear waeren es im zweiten Jahr 18000 - der geometrische Verlauf liegt
    // darueber, weil der Prozentsatz auf einen kleineren Wert wirkt.
    expect(restwert(30000, 0.2, 2)).toBeGreaterThan(30000 - 2 * 0.2 * 30000);
  });

  it('macht den Wertverlust zum groessten Posten der Rechnung', () => {
    const e = { kmProJahr: 15000, budgetEur: 50000 };
    const v = vergleichen(fahrzeug(), referenz, e, annahmen);
    const wertverlust =
      36000 - restwert(36000, annahmen.wertverlustElektrischProJahr, annahmen.haltedauerJahre);
    const laufend =
      annahmen.haltedauerJahre * jahreskostenElektrisch(fahrzeug(), e.kmProJahr, annahmen);

    expect(wertverlust).toBeGreaterThan(laufend);
    expect(v.jahresreihe.at(-1)?.kumuliertElektrisch).toBe(Math.round(wertverlust + laufend));
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

  it('rechnet ohne Fahrleistung nur Wertverlust, Steuer und THG-Quote', () => {
    const v = vergleichen(fahrzeug(), referenz, { kmProJahr: 0, budgetEur: 50000 }, annahmen);
    // Ohne Fahrleistung bleiben je Jahr 100 Euro Steuer auf der Verbrennerseite
    // und 70 Euro THG-Gutschrift auf der elektrischen - dazu der Wertverlust,
    // der auch im Stand anfaellt.
    const jahre = annahmen.haltedauerJahre;
    const elektrisch = Math.round(
      36000 - restwert(36000, annahmen.wertverlustElektrischProJahr, jahre) - jahre * 70,
    );
    const verbrenner = Math.round(
      30000 - restwert(30000, annahmen.wertverlustVerbrennerProJahr, jahre) + jahre * 100,
    );
    expect(v.jahresreihe.at(-1)).toEqual({
      jahr: jahre,
      kumuliertElektrisch: elektrisch,
      kumuliertVerbrenner: verbrenner,
    });
    expect(v.differenzGesamtEur).toBe(verbrenner - elektrisch);
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

  it('meldet fruehestens das Jahr 1, auch wenn das Elektroauto klar guenstiger ist', () => {
    // Im Jahr 0 stehen beide Seiten zwangslaeufig bei null. Ein Treffer dort
    // waere ein Artefakt des Anfangs, keine Aussage ueber die Kosten.
    const v = vergleichen(
      fahrzeug({ listenpreisEur: 25000 }),
      referenz,
      { kmProJahr: 15000, budgetEur: 50000 },
      annahmen,
    );
    expect(v.breakEvenJahr).toBe(1);
  });

  it('dreht das Ergebnis, wenn das Elektroauto seinen Wert schlechter haelt', () => {
    const e = { kmProJahr: 15000, budgetEur: 50000 };
    const gleich = vergleichen(fahrzeug(), referenz, e, {
      ...annahmen,
      wertverlustElektrischProJahr: annahmen.wertverlustVerbrennerProJahr,
    });
    const schlechter = vergleichen(fahrzeug(), referenz, e, annahmen);

    // Genau das war der blinde Fleck der frueheren Fassung: ein schnellerer
    // Wertverlust auf der elektrischen Seite verschlechtert das Ergebnis, und
    // zwar in einer Groessenordnung, die das Verdikt kippen kann.
    expect(schlechter.differenzGesamtEur).toBeLessThan(gleich.differenzGesamtEur);
    expect(gleich.differenzGesamtEur - schlechter.differenzGesamtEur).toBeGreaterThan(1000);
  });

  it('findet das kleinste Jahr ohne Mehrkosten', () => {
    const v = vergleichen(
      fahrzeug(),
      referenz,
      { kmProJahr: 30000, budgetEur: 50000 },
      langerZeitraum,
    );
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
    // Anschaffung genau so viel mehr, wie es ueber den Zeitraum zusaetzlich spart.
    const vielfahrer = { kmProJahr: 30000, budgetEur: 60000 };
    const guenstigeReferenz: Referenz = { ...referenz, listenpreisEur: 30000 };

    const frueh = fahrzeug({ id: 'a-frueh', listenpreisEur: 36000, verbrauchKwhPro100km: 16 });
    const mehrErsparnisProJahr =
      jahreskostenElektrisch(frueh, vielfahrer.kmProJahr, langerZeitraum) -
      jahreskostenElektrisch(
        fahrzeug({ verbrauchKwhPro100km: 8 }),
        vielfahrer.kmProJahr,
        langerZeitraum,
      );
    // Ein hoeherer Listenpreis schlaegt nicht mehr voll durch, sondern nur ueber
    // den Anteil, der bis zum Ende der Haltedauer an Wert verloren geht.
    const verlustAnteil =
      1 -
      Math.pow(1 - langerZeitraum.wertverlustElektrischProJahr, langerZeitraum.haltedauerJahre);
    const spaet = fahrzeug({
      id: 'b-spaet',
      listenpreisEur:
        36000 + (langerZeitraum.haltedauerJahre * mehrErsparnisProJahr) / verlustAnteil,
      verbrauchKwhPro100km: 8,
    });

    const a = vergleichen(frueh, guenstigeReferenz, vielfahrer, langerZeitraum);
    const b = vergleichen(spaet, guenstigeReferenz, vielfahrer, langerZeitraum);
    expect(a.differenzGesamtEur).toBe(b.differenzGesamtEur);
    expect(a.breakEvenJahr).not.toBeNull();
    expect(b.breakEvenJahr).not.toBeNull();
    expect(a.breakEvenJahr!).toBeLessThan(b.breakEvenJahr!);

    const ergebnis = empfehlenAus([spaet, frueh], [guenstigeReferenz], vielfahrer, langerZeitraum);
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
