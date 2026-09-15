'use client';

/**
 * Ereignisnamen sind fest. Wer hier einen Namen aendert, macht den Umami-Funnel
 * unbrauchbar, weil die Historie nicht mitwandert.
 */
export const EREIGNIS = {
  rechnerGesehen: 'calc_viewed',
  eingabeGeaendert: 'calc_input_changed',
  ergebnisFertig: 'calc_completed',
  ctaGesehen: 'offer_cta_viewed',
  ctaGeklickt: 'offer_cta_clicked',
  weiterleitung: 'partner_redirect',
} as const;

const INTERN_SCHLUESSEL = 'ampmatch.intern';

type UmamiFenster = Window & {
  umami?: { track: (name: string, daten?: Record<string, unknown>) => void };
};

function internerZugriff(): boolean {
  try {
    return window.localStorage.getItem(INTERN_SCHLUESSEL) === '1';
  } catch {
    return false;
  }
}

/**
 * Setzt die Kennung fuer interne Zugriffe. Aufruf ueber ?intern=1, zusaetzlich
 * wird Umami selbst stillgelegt, damit auch der Seitenaufruf nicht zaehlt.
 */
export function internKennzeichnen(aktiv: boolean): void {
  try {
    if (aktiv) {
      window.localStorage.setItem(INTERN_SCHLUESSEL, '1');
      window.localStorage.setItem('umami.disabled', '1');
    } else {
      window.localStorage.removeItem(INTERN_SCHLUESSEL);
      window.localStorage.removeItem('umami.disabled');
    }
  } catch {
    // Kein Speicher, kein Ausschluss. Kein Grund, die Seite scheitern zu lassen.
  }
}

export function melde(name: string, daten?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (internerZugriff()) return;
  (window as UmamiFenster).umami?.track(name, daten);
}

export function kmKlasse(km: number): string {
  if (km < 10_000) return 'unter-10k';
  if (km < 15_000) return '10k-15k';
  if (km < 20_000) return '15k-20k';
  if (km < 30_000) return '20k-30k';
  return 'ab-30k';
}

export function budgetKlasse(budget: number): string {
  if (budget < 25_000) return 'unter-25k';
  if (budget < 35_000) return '25k-35k';
  if (budget < 45_000) return '35k-45k';
  if (budget < 55_000) return '45k-55k';
  return 'ab-55k';
}
