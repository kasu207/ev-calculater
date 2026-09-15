import { fahrzeuge } from '@ampmatch/core';
import type { Fahrzeug } from '@ampmatch/core';

/**
 * Partnerlinks werden ausschliesslich hier gebaut, auf dem Server. Der Client
 * bekommt fertige Adressen und setzt nie selbst einen Trackingparameter zusammen.
 *
 * AMPMATCH_FLEXOFFERS_DEEPLINK_BASIS ist die Deep-Link-Adresse aus dem
 * FlexOffers-Konto, zum Beispiel
 * https://track.flexlinks.com/a.ashx?foid=123&fot=9999&foc=3
 * Ohne gesetzte Variable zeigt der Link direkt auf die Partnerseite; der Klick
 * ist dann nicht zuordenbar. Vor dem Start also setzen.
 */
export function partnerUrlFuer(fahrzeug: Fahrzeug): string {
  const basis = process.env.AMPMATCH_FLEXOFFERS_DEEPLINK_BASIS?.trim();
  if (!basis) return fahrzeug.partnerUrl;

  let deeplink: URL;
  try {
    deeplink = new URL(basis);
  } catch {
    return fahrzeug.partnerUrl;
  }

  deeplink.searchParams.set('url', fahrzeug.partnerUrl);
  const kennung = process.env.AMPMATCH_FLEXOFFERS_SUBID?.trim();
  deeplink.searchParams.set('fobs', kennung ? `${kennung}-${fahrzeug.id}` : fahrzeug.id);
  return deeplink.toString();
}

/** Fertige Links für alle ausgelieferten Modelle, zum Durchreichen an den Client. */
export function allePartnerUrls(): Record<string, string> {
  return Object.fromEntries(fahrzeuge.map((f) => [f.id, partnerUrlFuer(f)]));
}

export const PROVISION_EUR = 10;

export const OFFENLEGUNG = `Wenn du dort eine Anfrage stellst, zahlt Carwow uns ${PROVISION_EUR} €. Dein Preis ändert sich dadurch nicht.`;
