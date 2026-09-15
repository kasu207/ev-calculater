/**
 * Bausteine, die aus dem Ergebnis eine Handlung machen.
 *
 * Der Rechner endete bisher in einem Textfeld zum Kopieren. Genau dort ist
 * die Absicht des Nutzers am höchsten - und genau dort passierte nichts
 * Nachvollziehbares. Diese Datei füllt diese Stelle: Hebel mit gerechneter
 * Wirkung, ein teilbarer Link und eine Möglichkeit, das Ergebnis zu sichern.
 *
 * Reihenfolge ist Absicht: erst der Nutzen, dann die Frage nach der Adresse.
 * Umgekehrt wäre es eine Mautschranke, und Mautschranken werden umfahren.
 */

import { money, signedMoney, duration } from '../shared/format.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Monate als "8 Monate" / "1 Jahr 2 Monate". */
function months(value) {
  const rounded = Math.round(value);
  if (rounded <= 0) return 'keine Verschiebung';
  if (rounded < 12) return `${rounded} ${rounded === 1 ? 'Monat' : 'Monate'}`;
  return duration(rounded / 12);
}

/**
 * Hebel mit ausgerechneter Wirkung. Ein Partnerhinweis erscheint nur, wenn
 * ein Partner konfiguriert und aktiviert ist - sonst bleibt der Hebel als
 * reiner Hinweis stehen, was für den Nutzer der ehrlichere Zustand ist.
 */
export function leversBlock(levers, partners) {
  const useful = (levers || []).filter((l) => l.breakEvenGainMonths >= 1 || l.totalGain >= 150);
  if (!useful.length) return '';

  const byLever = new Map((partners || []).map((p) => [p.leverId, p]));

  const cards = useful
    .map((lever) => {
      const partner = byLever.get(lever.id);
      return `<article class="lever">
        <h4>${esc(lever.title)}</h4>
        <p class="lever__change">${esc(lever.change)}</p>
        <p class="lever__effect">
          <strong>${esc(months(lever.breakEvenGainMonths))} früher</strong> am Break-even
          <span class="muted">${esc(signedMoney(lever.totalGain))} über die Haltedauer</span>
        </p>
        <p class="lever__why">${esc(lever.explanation)}</p>
        <p class="note">${esc(lever.assumption)}</p>
        ${
          partner
            ? `<p class="lever__cta">
                 <a class="btn btn--ghost" href="${esc(partner.url)}" target="_blank"
                    rel="sponsored nofollow noopener" data-partner="${esc(partner.id)}">
                   ${esc(partner.label)}
                 </a>
                 <span class="ad-flag">Anzeige</span>
               </p>
               <p class="note">${esc(partner.description)}</p>`
            : ''
        }
      </article>`;
    })
    .join('');

  return `<section class="panel" id="leverPanel">
      <div class="panel__head">
        <div>
          <h3>Was Ihr Ergebnis noch verbessert</h3>
          <p class="note">Jede Zeile ist einmal komplett durchgerechnet, nicht geschätzt. Die
          Wirkung gilt für das gerade ausgewählte Fahrzeug und Ihre Eingaben.${
            byLever.size
              ? ' Mit „Anzeige“ gekennzeichnete Verweise sind vergütete Empfehlungen - für Sie ohne Aufpreis.'
              : ''
          }</p>
        </div>
      </div>
      <div class="lever-grid">${cards}</div>
    </section>`;
}

/**
 * Teilen und Sichern. Der Link enthält nur die Rechenwerte, keine Adresse -
 * das steht auch so dabei, weil sonst zu Recht niemand darauf klickt.
 */
export function shareBlock(shareUrl) {
  return `<div class="share">
      <div class="share__text">
        <h4>Ergebnis behalten</h4>
        <p class="note">Der Link enthält Ihre Eingaben, keine persönlichen Daten. Speichern Sie
        ihn als Lesezeichen oder schicken Sie ihn sich selbst.</p>
      </div>
      <div class="share__actions">
        <input type="text" id="shareUrl" readonly value="${esc(shareUrl)}" aria-label="Link zum Ergebnis" />
        <button type="button" class="btn btn--ghost" id="shareBtn">Link kopieren</button>
      </div>
    </div>`;
}

/**
 * Erfassung der E-Mail-Adresse. Bewusst nach dem Ergebnis und ohne jede
 * Verknappung: wer eine Adresse mit Druck einsammelt, bekommt Adressen, die
 * nichts wert sind. Die Einwilligung ist ausdrücklich und zweckgebunden.
 */
export function leadBlock(vehicleLabel) {
  return `<section class="panel leadbox" id="leadPanel">
      <div class="leadbox__intro">
        <h3>Ergebnis per E-Mail sichern</h3>
        <p>Sie bekommen Ihre Rechnung als Link zugeschickt${vehicleLabel ? ` - inklusive der Zahlen zum ${esc(vehicleLabel)}` : ''}.
        Kaufentscheidungen dieser Größenordnung trifft kaum jemand am selben Tag.</p>
      </div>
      <form class="leadbox__form" id="leadForm" novalidate>
        <div class="leadbox__row">
          <label class="field">
            <span class="field__label">E-Mail-Adresse</span>
            <input type="email" name="email" id="leadEmail" required autocomplete="email"
              placeholder="name@beispiel.de" />
          </label>
          <button type="submit" class="btn btn--primary" id="leadSubmit">Ergebnis zuschicken</button>
        </div>

        <fieldset class="leadbox__purpose">
          <legend class="field__label">Was möchten Sie zusätzlich?</legend>
          <label class="check"><input type="radio" name="purpose" value="result" checked />
            <span>Nur mein Ergebnis</span></label>
          <label class="check"><input type="radio" name="purpose" value="updates" />
            <span>Auch eine Nachricht, wenn sich Förderung oder Preise deutlich ändern</span></label>
          <label class="check"><input type="radio" name="purpose" value="dealer" />
            <span>Auch Angebote von Händlern zum ausgewählten Modell</span></label>
        </fieldset>

        <label class="check check--consent">
          <input type="checkbox" name="consent" id="leadConsent" required />
          <span>Ich bin damit einverstanden, dass meine Adresse zu diesem Zweck gespeichert und
          verwendet wird. Der Widerruf ist jederzeit möglich. Näheres in der
          <a href="/datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a>.</span>
        </label>

        <!-- Für Menschen unsichtbar. Wer hier etwas einträgt, ist ein Bot. -->
        <div class="honeypot" aria-hidden="true">
          <label>Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </div>

        <p class="note">Doppelte Bestätigung: Ohne Klick im Bestätigungslink wird die Adresse nicht
        verwendet. Keine Weitergabe an Dritte ohne Ihre ausdrückliche Zustimmung.</p>
        <p class="leadbox__status" id="leadStatus" role="status" aria-live="polite"></p>
      </form>
    </section>`;
}

export { esc as escapeForConversion, months as formatMonths, money as formatMoney };
