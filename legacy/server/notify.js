/**
 * Versandnaht für Bestätigungs- und Ergebnismails.
 *
 * Hier steht bewusst kein Mailversand, sondern nur die Stelle, an der einer
 * angeschlossen wird. Grund: ein SMTP-Client wäre die erste Abhängigkeit des
 * Projekts, und welcher Dienst am Ende verwendet wird, entscheidet sich nach
 * Preis und Zustellrate - nicht beim Schreiben dieses Codes.
 *
 * Betrieb:
 * - MAIL_WEBHOOK_URL gesetzt: die Nachricht wird als JSON dorthin geschickt.
 *   Jeder Dienst mit eingehendem Webhook nimmt das an (Brevo, Mailjet,
 *   n8n, Make). Optional MAIL_WEBHOOK_TOKEN als Bearer-Token.
 * - nicht gesetzt: die Nachricht landet im Log. In der Anlaufphase reicht
 *   das, weil die Bestätigungslinks dort ablesbar sind.
 */

const WEBHOOK = process.env.MAIL_WEBHOOK_URL || '';
const TOKEN = process.env.MAIL_WEBHOOK_TOKEN || '';

export function confirmMail(lead, siteUrl) {
  const link = `${siteUrl}/bestaetigen?token=${lead.confirmToken}`;
  const purposeLine =
    lead.purpose === 'dealer'
      ? 'Sie möchten Angebote von Händlern erhalten.'
      : lead.purpose === 'updates'
        ? 'Sie möchten Hinweise bekommen, wenn sich Preise oder Förderung ändern.'
        : 'Sie möchten Ihr Rechenergebnis per Mail sichern.';

  return {
    to: lead.email,
    subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
    text: [
      'Guten Tag,',
      '',
      'Sie haben Ihre Adresse im E-Auto-Rechner eingetragen.',
      purposeLine,
      '',
      'Bitte bestätigen Sie mit einem Klick:',
      link,
      '',
      'Wenn Sie das nicht waren, ignorieren Sie diese Nachricht einfach. Ohne',
      'Bestätigung wird die Adresse nicht verwendet und nach 30 Tagen gelöscht.',
      '',
      'E-Auto-Rechner',
    ].join('\n'),
    meta: { leadId: lead.id, purpose: lead.purpose, vehicleId: lead.vehicleId },
  };
}

/**
 * Stellt die Nachricht zu, soweit möglich. Ein Fehlschlag darf die Anfrage
 * des Nutzers nicht scheitern lassen - der Datensatz ist bereits gespeichert
 * und lässt sich jederzeit erneut versenden.
 */
export async function deliver(message) {
  if (!WEBHOOK) {
    console.log('[mail] kein MAIL_WEBHOOK_URL gesetzt, Nachricht nur protokolliert:');
    console.log(`[mail] an ${message.to}: ${message.subject}`);
    console.log(message.text);
    return { delivered: false, reason: 'kein Webhook konfiguriert' };
  }
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Webhook antwortete mit ${res.status}`);
    return { delivered: true };
  } catch (err) {
    console.error('[mail] Zustellung fehlgeschlagen:', err.message);
    return { delivered: false, reason: err.message };
  }
}
