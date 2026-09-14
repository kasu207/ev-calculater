import { Rechner } from '@/components/Rechner';
import { allePartnerUrls } from '@/lib/partner';
import type { Eingabe } from '@ampmatch/core';

/**
 * Serverseitig gerenderte Rechenflaeche. Die Partnerlinks werden hier fertig
 * gebaut und an den Client durchgereicht, damit im Browser nie ein
 * Trackingparameter zusammengesetzt wird.
 */
export function RechnerSeite({ eingabe }: { eingabe: Eingabe }) {
  return <Rechner eingabe={eingabe} partnerUrls={allePartnerUrls()} />;
}
