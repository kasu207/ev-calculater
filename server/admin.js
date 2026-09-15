/**
 * Kennzahlen-Übersicht.
 *
 * Der Zweck ist eng: sichtbar machen, an welcher Stelle des Trichters die
 * Leute verloren gehen, und ob die Ertragsquellen überhaupt geklickt werden.
 * Alles, was darüber hinausgeht, wäre zum jetzigen Zeitpunkt Beschäftigung.
 *
 * Zugang über ADMIN_TOKEN. Ohne gesetztes Token ist die Seite abgeschaltet,
 * nicht offen - eine offene Auswertungsseite wäre ein Datenleck mit Ansage.
 */

import { funnel, listLeads } from './store.js';
import { forecastRevenue, partners } from '../shared/partners.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
const pct = (v) => `${(v * 100).toFixed(1)} %`;
const eur = (v) => `${v.toFixed(2)} EUR`;

export function isAuthorized(token) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return false;
  // Längengleicher Vergleich, damit die Laufzeit nichts verrät.
  if (typeof token !== 'string' || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function bar(value, max) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<span class="admin-bar"><span style="width:${width}%"></span></span>`;
}

export function renderAdmin(days = 30) {
  const f = funnel(days);
  const leads = listLeads();
  const forecast = forecastRevenue(f.partnerClicks);
  const maxDay = Math.max(1, ...Object.values(f.byDay));

  const funnelRows = [
    ['Besucher', f.visitors, ''],
    ['Ergebnis gesehen', f.results, pct(f.rates.resultFromVisit)],
    ['Formular geöffnet', f.leadOpens, ''],
    ['Adresse eingetragen', f.leads, pct(f.rates.leadFromResult)],
    ['Adresse bestätigt', f.leadsConfirmed, ''],
    ['davon Händleranfragen', f.dealerLeads, ''],
    ['Partnerklicks', f.partnerClickTotal, pct(f.rates.partnerClickFromResult)],
    ['Ergebnis geteilt', f.shares, ''],
  ];

  const inactive = partners.filter((p) => !p.enabled);

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Kennzahlen - E-Auto-Rechner</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
      .admin { max-width: 900px; margin: 0 auto; padding: 24px 16px 64px; }
      .admin table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
      .admin th, .admin td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
      .admin td.num, .admin th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .admin-bar { display: block; height: 8px; background: var(--surface-3); border-radius: 4px; }
      .admin-bar > span { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="admin">
      <h1>Kennzahlen der letzten ${days} Tage</h1>
      <p class="note">Cookielos erhoben. Besucher sind über einen tagesrollierenden Hash gezählt,
      der nicht zurückrechenbar ist - die Zahl ist damit eher zu niedrig als zu hoch.</p>

      <h2>Trichter</h2>
      <table>
        <thead><tr><th>Schritt</th><th class="num">Anzahl</th><th class="num">Quote</th></tr></thead>
        <tbody>
          ${funnelRows
            .map(
              ([label, value, rate]) =>
                `<tr><th>${esc(label)}</th><td class="num">${value}</td><td class="num">${esc(rate)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2>Ertragsprognose</h2>
      <p class="note">Klicks mal hinterlegter Abschlussquote mal Vergütung. Das ist eine Schätzung
      auf Basis von Annahmen aus shared/partners.js - die tatsächliche Abrechnung des Partners
      geht immer vor.</p>
      <table>
        <thead><tr><th>Quelle</th><th class="num">Klicks</th><th class="num">Erwartet</th><th>Status</th></tr></thead>
        <tbody>
          ${forecast.rows
            .map(
              (r) =>
                `<tr><th>${esc(r.label)}</th><td class="num">${r.clicks}</td><td class="num">${esc(eur(r.expected))}</td><td>${r.enabled ? 'aktiv' : 'nicht aktiviert'}</td></tr>`,
            )
            .join('')}
          <tr><th>Summe</th><td class="num"></td><td class="num"><strong>${esc(eur(forecast.total))}</strong></td><td></td></tr>
        </tbody>
      </table>
      ${
        inactive.length
          ? `<p class="note">${inactive.length} von ${partners.length} Ertragsquellen sind noch nicht
             aktiviert. Solange kein Partnervertrag besteht, ist das richtig so - eingeschaltet
             würden Platzhalterlinks ausgeliefert.</p>`
          : ''
      }

      <h2>Besuche je Tag</h2>
      <table>
        <tbody>
          ${
            Object.keys(f.byDay).length === 0
              ? '<tr><td>Noch keine Daten.</td></tr>'
              : Object.entries(f.byDay)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([day, n]) => `<tr><th>${esc(day)}</th><td class="num">${n}</td><td>${bar(n, maxDay)}</td></tr>`)
                  .join('')
          }
        </tbody>
      </table>

      <h2>Letzte Anfragen</h2>
      <table>
        <thead><tr><th>Datum</th><th>Zweck</th><th>Fahrzeug</th><th>Status</th></tr></thead>
        <tbody>
          ${
            leads.length === 0
              ? '<tr><td colspan="4">Noch keine Anfragen.</td></tr>'
              : leads
                  .slice(-25)
                  .reverse()
                  .map(
                    (l) =>
                      `<tr><td>${esc(l.createdAt.slice(0, 16).replace('T', ' '))}</td><td>${esc(l.purpose)}</td><td>${esc(l.vehicleId || '-')}</td><td>${esc(l.status)}</td></tr>`,
                  )
                  .join('')
          }
        </tbody>
      </table>
      <p class="note">E-Mail-Adressen werden hier nicht angezeigt. Sie stehen in
      data/leads.jsonl und gehören nicht in eine Seite, die versehentlich offen stehen kann.</p>
    </div>
  </body>
</html>`;
}
