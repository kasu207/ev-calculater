/**
 * Serverseitig gerenderte Seiten.
 *
 * Alles hier ist reines HTML ohne JavaScript-Zwang: eine Suchmaschine, ein
 * Messenger-Vorschaubot und ein Nutzer mit abgeschaltetem JavaScript sehen
 * denselben Inhalt. Die Seiten sind aus der Rechenlogik erzeugt, nicht von
 * Hand getextet - dadurch bleiben sie automatisch aktuell, wenn sich
 * Fahrzeugdaten oder Annahmen ändern.
 *
 * Gerendert wird mit Template-Literalen. Ein Template-System würde hier nur
 * eine Abhängigkeit hinzufügen, ohne etwas zu vereinfachen.
 */

import { vehicles, vehicleLabel, BODY_LABELS, DATA_VINTAGE } from '../shared/vehicles.js';
import { compareVehicle } from '../shared/calc.js';
import { recommend } from '../shared/match.js';
import { withDefaults } from '../shared/defaults.js';
import { decodeInput } from '../shared/share.js';
import { money, number, decimal, duration, signedMoney, moneyExact } from '../shared/format.js';
import {
  KM_PROFILES,
  breakEvenMatrix,
  relatedVehicles,
  rankingForKm,
  vehicleBySlug,
  vehicleMeta,
  kmProfileMeta,
} from '../shared/seo.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Gerenderte Seiten werden zwischengespeichert. Die Eingaben sind statisch,
 * also ist jede Seite nach dem ersten Aufruf reine Speicherausgabe - das
 * hält auch einen kleinen Server bei einem Besucherstoß ruhig.
 */
const cache = new Map();
function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

function breadcrumbJsonLd(site, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${site}${item.path}`,
    })),
  };
}

function layout({ site, title, description, path, jsonLd = [], body, noindex = false }) {
  const canonical = `${site}${path}`;
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    ${noindex ? '<meta name="robots" content="noindex,follow" />' : ''}
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:site_name" content="E-Auto-Rechner" />
    <meta name="twitter:card" content="summary" />
    <link rel="stylesheet" href="/styles.css" />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232a78d6'/%3E%3Cpath d='M18 5 9 18h6l-1 9 9-13h-6z' fill='%23fff'/%3E%3C/svg%3E"
    />
    ${jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`).join('\n    ')}
  </head>
  <body class="page">
    <header class="site-header">
      <a class="brand" href="/">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M18 5 9 18h6l-1 9 9-13h-6z" fill="var(--surface-0)" />
          </svg>
        </span>
        <span class="brand__text">
          <strong>E-Auto-Rechner</strong>
          <small>Ab wann lohnt sich der Umstieg?</small>
        </span>
      </a>
      <div class="header-actions">
        <a class="btn btn--primary" href="/">Eigene Werte rechnen</a>
      </div>
    </header>
    <main class="page__main">
${body}
    </main>
    <footer class="site-footer site-footer--page">
      <nav class="footer-nav" aria-label="Weitere Seiten">
        <a href="/e-auto">Alle Modelle</a>
        ${KM_PROFILES.map((km) => `<a href="/fahrprofil/${km}-km">${number(km)} km/Jahr</a>`).join('\n        ')}
      </nav>
      <p class="note">
        ${esc(DATA_VINTAGE)}. Alle Angaben sind Richtwerte zur Überschlagsrechnung und ersetzen
        kein Angebot. Kein Rechts-, Steuer- oder Anlagerat.
      </p>
      <nav class="footer-nav" aria-label="Rechtliches">
        <a href="/datenschutz.html">Datenschutz</a>
        <a href="/impressum.html">Impressum</a>
      </nav>
    </footer>
  </body>
</html>`;
}

/* ------------------------------------------------------------- Bausteine */

function matrixTable(vehicle, matrix) {
  const rows = matrix
    .map(
      (r) => `<tr>
          <th scope="row">${number(r.kmPerYear)} km</th>
          <td>${r.breakEvenYears === null ? `<span class="neg">über ${r.years} Jahre</span>` : `<span class="pos">${esc(duration(r.breakEvenYears))}</span>`}</td>
          <td>${esc(signedMoney(r.annualSavings))}</td>
          <td class="${r.totalAdvantage >= 0 ? 'pos' : 'neg'}">${esc(signedMoney(r.totalAdvantage))}</td>
        </tr>`,
    )
    .join('');
  return `<div class="table-scroll"><table class="data-table">
      <caption>Ab welcher Fahrleistung rechnet sich der ${esc(vehicleLabel(vehicle))}?</caption>
      <thead>
        <tr><th scope="col">Fahrleistung</th><th scope="col">Break-even</th><th scope="col">Ersparnis pro Jahr</th><th scope="col">Vorteil nach 8 Jahren</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function costTable(comparison) {
  const rows = comparison.yearly
    .filter((y) => y.year > 0)
    .map(
      (y) => `<tr>
          <th scope="row">Jahr ${y.year}</th>
          <td>${esc(money(y.cumulativeIce))}</td>
          <td>${esc(money(y.cumulativeEv))}</td>
          <td class="${y.advantage >= 0 ? 'pos' : 'neg'}">${esc(signedMoney(y.advantage))}</td>
        </tr>`,
    )
    .join('');
  return `<div class="table-scroll"><table class="data-table">
      <caption>Kumulierte Gesamtkosten inklusive Wertverlust</caption>
      <thead><tr><th scope="col">Zeitpunkt</th><th scope="col">${esc(comparison.scenarioLabel)}</th><th scope="col">E-Auto</th><th scope="col">Vorteil E-Auto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function specTable(vehicle) {
  const rows = [
    ['Karosserie', BODY_LABELS[vehicle.body] || vehicle.body],
    ['Listenpreis (UVP-Richtwert)', money(vehicle.price)],
    ['Batterie', `${decimal(vehicle.batteryKwh)} kWh`],
    ['Reichweite WLTP', `${number(vehicle.rangeKm)} km`],
    ['Realistische Reichweite', `${number(Math.round(vehicle.rangeKm * 0.78))} km`],
    ['Verbrauch', `${decimal(vehicle.consumptionKwh100)} kWh/100 km`],
    ['Ladeleistung DC / AC', `${number(vehicle.dcPeakKw)} kW / ${decimal(vehicle.acPeakKw)} kW`],
    ['Sitzplätze', number(vehicle.seats)],
    ['Kofferraum', `${number(vehicle.bootLiters)} l`],
    ['Anhängelast gebremst', vehicle.towing ? `${number(vehicle.towing)} kg` : 'nicht vorgesehen'],
    ['Batteriegarantie', `${vehicle.warrantyBatteryYears} Jahre`],
  ];
  return `<div class="table-scroll"><table class="data-table data-table--specs">
      <caption>Technische Daten</caption>
      <tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

/** Aus den Zahlen abgeleitete Einordnung - keine freie Textbehauptung. */
function suitability(vehicle, matrix) {
  const firstProfitable = matrix.find((r) => r.breakEvenYears !== null && r.breakEvenYears <= 6);
  const pros = [];
  const cons = [];

  if (firstProfitable) {
    pros.push(
      `Ab etwa ${number(firstProfitable.kmPerYear)} km im Jahr ist der Break-even nach ${duration(firstProfitable.breakEvenYears)} erreicht.`,
    );
  } else {
    cons.push(
      'Bei keiner der üblichen Fahrleistungen wird der Aufpreis innerhalb von sechs Jahren wieder eingefahren.',
    );
  }
  if (vehicle.dcPeakKw >= 130) pros.push(`${number(vehicle.dcPeakKw)} kW Ladeleistung machen Langstrecke praktikabel.`);
  else cons.push(`Mit ${number(vehicle.dcPeakKw)} kW Ladeleistung dauern Ladepausen auf Langstrecke spürbar länger.`);
  if (vehicle.rangeKm >= 450) pros.push(`${number(vehicle.rangeKm)} km WLTP decken auch längere Strecken ohne Zwischenstopp ab.`);
  if (vehicle.rangeKm < 300) cons.push(`${number(vehicle.rangeKm)} km WLTP bedeuten im Winter realistisch unter ${number(Math.round(vehicle.rangeKm * 0.62))} km.`);
  if (vehicle.towing > 0) pros.push(`Anhängelast bis ${number(vehicle.towing)} kg gebremst.`);
  else cons.push('Keine Anhängerkupplung vorgesehen.');
  if (vehicle.price < 30000) pros.push('Anschaffungspreis unter 30.000 Euro begrenzt den Wertverlust in Euro.');

  return `<div class="pro-contra">
      <div>
        <h3>Dafür</h3>
        <ul>${pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
      <div>
        <h3>Dagegen</h3>
        <ul>${cons.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
    </div>`;
}

function ctaBlock(href, headline, text) {
  return `<aside class="cta">
      <h2>${esc(headline)}</h2>
      <p>${esc(text)}</p>
      <a class="btn btn--primary btn--large" href="${esc(href)}">Mit eigenen Werten rechnen</a>
      <p class="note">Kostenlos, ohne Anmeldung. Die Eingaben bleiben in Ihrem Browser.</p>
    </aside>`;
}

/* ----------------------------------------------------------- Seitentypen */

export function renderVehiclePage(slug, site) {
  const vehicle = vehicleBySlug(slug);
  if (!vehicle) return null;

  return cached(`vehicle:${slug}:${site}`, () => {
    const input = withDefaults({});
    const comparison = compareVehicle(input, vehicle);
    const matrix = breakEvenMatrix(vehicle);
    const related = relatedVehicles(vehicle);
    const label = vehicleLabel(vehicle);
    const meta = vehicleMeta(vehicle, comparison);
    const path = `/e-auto/${slug}`;

    const headline =
      comparison.breakEvenYears === null
        ? `${label}: bei 15.000 km im Jahr rechnet sich der Umstieg nicht`
        : `${label}: Break-even nach ${duration(comparison.breakEvenYears)}`;

    const body = `
      <article class="article">
        <nav class="crumbs" aria-label="Brotkrumen">
          <a href="/">Rechner</a> <span aria-hidden="true">/</span>
          <a href="/e-auto">Modelle</a> <span aria-hidden="true">/</span>
          <span>${esc(label)}</span>
        </nav>

        <h1>Lohnt sich der ${esc(label)}?</h1>
        <p class="lead">${esc(headline)}. Gerechnet gegen einen Benziner mit 7,2 l/100 km bei
        15.000 km Fahrleistung, 0,32 Euro je kWh zu Hause und acht Jahren Haltedauer -
        inklusive Wertverlust, Versicherung, Steuer, Wartung und Kapitalkosten.</p>

        <div class="tiles">
          <div class="tile"><p class="tile__label">Break-even</p><p class="tile__value">${esc(comparison.breakEvenYears === null ? 'nicht in 8 Jahren' : duration(comparison.breakEvenYears))}</p><p class="tile__note">${esc(comparison.breakEvenKm === null ? 'Aufpreis wird nicht eingefahren' : `entspricht ${number(comparison.breakEvenKm)} km`)}</p></div>
          <div class="tile"><p class="tile__label">Ersparnis im ersten Jahr</p><p class="tile__value">${esc(signedMoney(comparison.annual.savingsFirstYear))}</p><p class="tile__note">laufende Kosten gegenüber dem Verbrenner</p></div>
          <div class="tile"><p class="tile__label">Energiekosten je 100 km</p><p class="tile__value">${esc(moneyExact(comparison.costPer100Ev))}</p><p class="tile__note">Verbrenner ${esc(moneyExact(comparison.costPer100Ice))}</p></div>
          <div class="tile"><p class="tile__label">Vorteil nach 8 Jahren</p><p class="tile__value">${esc(signedMoney(comparison.totalAdvantage))}</p><p class="tile__note">inklusive Restwert</p></div>
        </div>

        <h2>Ab welcher Fahrleistung lohnt sich der ${esc(label)}?</h2>
        <p>Die Fahrleistung entscheidet fast alles: Der Aufpreis bleibt gleich, die Ersparnis je
        Kilometer nicht. Daraus ergibt sich für jedes Fahrprofil ein anderer Break-even.</p>
        ${matrixTable(vehicle, matrix)}

        ${ctaBlock(`/?v=${esc(slug)}`, 'Ihre Zahlen weichen ab?', 'Verbrauch, Versicherung, Strompreis und Haltedauer bestimmen das Ergebnis stärker als das Modell. Im Rechner setzen Sie Ihre eigenen Werte ein.')}

        <h2>Für wen sich der ${esc(label)} rechnet</h2>
        ${suitability(vehicle, matrix)}

        <h2>Kostenverlauf über acht Jahre</h2>
        <p>${esc(vehicle.note)}</p>
        ${costTable(comparison)}

        <h2>Technische Daten</h2>
        ${specTable(vehicle)}

        <h2>Ähnliche Modelle im gleichen Preisbereich</h2>
        <ul class="link-list">
          ${related.map((v) => `<li><a href="/e-auto/${esc(v.id)}">${esc(vehicleLabel(v))}</a> <span class="muted">${esc(money(v.price))} &middot; ${number(v.rangeKm)} km WLTP</span></li>`).join('\n          ')}
        </ul>

        <p class="note">${esc(DATA_VINTAGE)}. Listenpreis ist ein UVP-Richtwert für die
        Basisausstattung, kein Angebot. Der tatsächliche Wertverlust hängt von Modell, Ausstattung
        und Marktlage ab und ist der größte Unsicherheitsfaktor dieser Rechnung.</p>
      </article>`;

    return layout({
      site,
      path,
      title: meta.title,
      description: meta.description,
      body,
      jsonLd: [
        breadcrumbJsonLd(site, [
          { name: 'Rechner', path: '/' },
          { name: 'Modelle', path: '/e-auto' },
          { name: label, path },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `Ab wann rechnet sich der ${label}?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text:
                  comparison.breakEvenYears === null
                    ? `Bei 15.000 km im Jahr wird der Aufpreis innerhalb von acht Jahren nicht wieder eingefahren. Ab ${number(matrix.find((m) => m.breakEvenYears !== null)?.kmPerYear || 30000)} km pro Jahr kippt die Rechnung.`
                    : `Bei 15.000 km im Jahr nach ${duration(comparison.breakEvenYears)}, das entspricht rund ${number(comparison.breakEvenKm)} Kilometern.`,
              },
            },
            {
              '@type': 'Question',
              name: `Was kostet der ${label} an Energie je 100 Kilometer?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Rund ${moneyExact(comparison.costPer100Ev)} bei einem Mischpreis von ${decimal(comparison.kwhPrice * 100)} Cent je kWh. Ein vergleichbarer Benziner liegt bei ${moneyExact(comparison.costPer100Ice)}.`,
              },
            },
          ],
        },
      ],
    });
  });
}

export function renderVehicleIndex(site) {
  return cached(`index:${site}`, () => {
    const input = withDefaults({});
    const rows = vehicles
      .map((vehicle) => ({ vehicle, comparison: compareVehicle(input, vehicle) }))
      .sort((a, b) => a.vehicle.price - b.vehicle.price)
      .map(
        ({ vehicle, comparison }) => `<tr>
            <th scope="row"><a href="/e-auto/${esc(vehicle.id)}">${esc(vehicleLabel(vehicle))}</a></th>
            <td>${esc(BODY_LABELS[vehicle.body] || vehicle.body)}</td>
            <td>${esc(money(vehicle.price))}</td>
            <td>${number(vehicle.rangeKm)} km</td>
            <td>${comparison.breakEvenYears === null ? '<span class="neg">über 8 Jahre</span>' : `<span class="pos">${esc(duration(comparison.breakEvenYears))}</span>`}</td>
          </tr>`,
      )
      .join('');

    const body = `
      <article class="article">
        <nav class="crumbs" aria-label="Brotkrumen"><a href="/">Rechner</a> <span aria-hidden="true">/</span> <span>Modelle</span></nav>
        <h1>${vehicles.length} Elektroautos im Kostenvergleich</h1>
        <p class="lead">Für jedes Modell ist durchgerechnet, nach wie vielen Jahren der Aufpreis
        gegenüber einem Verbrenner wieder eingefahren ist. Grundlage ist ein Standardprofil mit
        15.000 km im Jahr, 7,2 l/100 km Vergleichsverbrauch und 0,32 Euro je kWh zu Hause.</p>
        <div class="table-scroll"><table class="data-table">
          <caption>Break-even bei 15.000 km pro Jahr, sortiert nach Listenpreis</caption>
          <thead><tr><th scope="col">Modell</th><th scope="col">Klasse</th><th scope="col">Listenpreis</th><th scope="col">WLTP</th><th scope="col">Break-even</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${ctaBlock('/', 'Das Standardprofil passt selten', 'Ihre Fahrleistung, Ihr Strompreis und Ihre Haltedauer verschieben den Break-even um Jahre. Der Rechner nimmt Ihre Werte.')}
        <h2>Nach Fahrleistung</h2>
        <ul class="link-list">
          ${KM_PROFILES.map((km) => `<li><a href="/fahrprofil/${km}-km">Welches E-Auto lohnt sich bei ${number(km)} km im Jahr?</a></li>`).join('\n          ')}
        </ul>
      </article>`;

    return layout({
      site,
      path: '/e-auto',
      title: `${vehicles.length} Elektroautos im Kostenvergleich: Break-even und Betriebskosten`,
      description: `Für ${vehicles.length} Elektroautos durchgerechnet: nach wie vielen Jahren der Aufpreis gegenüber einem Verbrenner wieder eingefahren ist, inklusive Wertverlust, Ladekosten und Versicherung.`,
      body,
      jsonLd: [
        breadcrumbJsonLd(site, [
          { name: 'Rechner', path: '/' },
          { name: 'Modelle', path: '/e-auto' },
        ]),
      ],
    });
  });
}

export function renderKmProfilePage(kmPerYear, site) {
  if (!KM_PROFILES.includes(kmPerYear)) return null;

  return cached(`km:${kmPerYear}:${site}`, () => {
    const ranking = rankingForKm(kmPerYear, 10);
    const meta = kmProfileMeta(kmPerYear);
    const path = `/fahrprofil/${kmPerYear}-km`;
    const winner = ranking[0];
    const profitable = ranking.filter((r) => r.comparison.breakEvenYears !== null).length;

    const rows = ranking
      .map(
        ({ vehicle, comparison }, index) => `<tr>
            <td>${index + 1}</td>
            <th scope="row"><a href="/e-auto/${esc(vehicle.id)}">${esc(vehicleLabel(vehicle))}</a></th>
            <td>${esc(money(vehicle.price))}</td>
            <td>${comparison.breakEvenYears === null ? '<span class="neg">über 8 Jahre</span>' : `<span class="pos">${esc(duration(comparison.breakEvenYears))}</span>`}</td>
            <td>${esc(signedMoney(comparison.annual.savingsFirstYear))}</td>
            <td class="${comparison.totalAdvantage >= 0 ? 'pos' : 'neg'}">${esc(signedMoney(comparison.totalAdvantage))}</td>
          </tr>`,
      )
      .join('');

    const body = `
      <article class="article">
        <nav class="crumbs" aria-label="Brotkrumen"><a href="/">Rechner</a> <span aria-hidden="true">/</span> <a href="/e-auto">Modelle</a> <span aria-hidden="true">/</span> <span>${number(kmPerYear)} km</span></nav>
        <h1>Welches E-Auto lohnt sich bei ${number(kmPerYear)} km im Jahr?</h1>
        <p class="lead">Bei ${number(kmPerYear)} Kilometern pro Jahr erreichen ${profitable} von
        ${vehicles.length} Modellen den Break-even innerhalb von acht Jahren. Am schnellsten ist
        der ${esc(vehicleLabel(winner.vehicle))}${winner.comparison.breakEvenYears === null ? '' : ` mit ${esc(duration(winner.comparison.breakEvenYears))}`}.</p>

        <div class="table-scroll"><table class="data-table">
          <caption>Schnellster Break-even bei ${number(kmPerYear)} km pro Jahr</caption>
          <thead><tr><th scope="col">#</th><th scope="col">Modell</th><th scope="col">Preis</th><th scope="col">Break-even</th><th scope="col">Ersparnis 1. Jahr</th><th scope="col">Vorteil nach 8 Jahren</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>

        ${ctaBlock('/', 'Fahrleistung ist nur die halbe Miete', 'Ladepreis, Versicherung und Haltedauer verschieben das Ergebnis genauso stark. Setzen Sie Ihre eigenen Werte ein.')}

        <h2>Warum die Fahrleistung so stark durchschlägt</h2>
        <p>Der Aufpreis eines E-Autos ist ein fester Betrag: Er fällt beim Kauf an, unabhängig
        davon, wie viel gefahren wird. Die Ersparnis dagegen entsteht je Kilometer - aus der
        Differenz zwischen Kraftstoff- und Ladekosten sowie aus geringerem Wartungsaufwand. Wer
        doppelt so viel fährt, fährt den Aufpreis in ungefähr der halben Zeit ein.</p>
        <p>Der zweite große Posten ist der Wertverlust. Er hängt am Kaufpreis, nicht an der
        Fahrleistung, und ist bei Neuwagen in den ersten Jahren der mit Abstand größte
        Kostenblock - deutlich vor Energie und Wartung.</p>

        <h2>Andere Fahrprofile</h2>
        <ul class="link-list">
          ${KM_PROFILES.filter((km) => km !== kmPerYear)
            .map((km) => `<li><a href="/fahrprofil/${km}-km">Bei ${number(km)} km im Jahr</a></li>`)
            .join('\n          ')}
        </ul>
      </article>`;

    return layout({
      site,
      path,
      title: meta.title,
      description: meta.description,
      body,
      jsonLd: [
        breadcrumbJsonLd(site, [
          { name: 'Rechner', path: '/' },
          { name: 'Modelle', path: '/e-auto' },
          { name: `${kmPerYear} km`, path },
        ]),
      ],
    });
  });
}

/**
 * Geteiltes Ergebnis. Wird nicht indexiert - es sind Millionen Varianten
 * derselben Seite, und genau dafür ist die Indexierung nicht gedacht. Der
 * Zweck ist die Vorschau in Messengern und ein Einstieg ohne JavaScript.
 */
export function renderResultPage(encoded, site) {
  const { input, vehicleId } = decodeInput(encoded);
  const result = recommend(input);
  const selected =
    (vehicleId && result.ranked.find((r) => r.vehicle.id === vehicleId)) || result.bestMatch;

  if (!selected) {
    return layout({
      site,
      path: `/ergebnis/${encoded || ''}`,
      noindex: true,
      title: 'Kein passendes Fahrzeug gefunden',
      description: 'Zu diesen Anforderungen passt kein Modell aus der Datenbasis.',
      body: `<article class="article"><h1>Kein Fahrzeug erfüllt diese Kriterien</h1>
        <p class="lead">Budget, Sitzplätze oder Anhängelast schließen alle Modelle aus.</p>
        ${ctaBlock('/', 'Kriterien anpassen', 'Im Rechner lassen sich die harten Kriterien lockern.')}</article>`,
    });
  }

  const c = selected.comparison;
  const label = vehicleLabel(selected.vehicle);
  const verdict =
    c.breakEvenYears === null
      ? `Bei diesem Profil rechnet sich der Umstieg innerhalb von ${c.years} Jahren nicht.`
      : `Der Umstieg rechnet sich nach ${duration(c.breakEvenYears)}.`;

  const body = `
    <article class="article">
      <h1>Ergebnis: ${esc(label)}</h1>
      <p class="lead">${esc(verdict)} Gerechnet mit ${number(input.profile.kmPerYear)} km im Jahr,
      ${decimal(input.current.consumptionL100)} l/100 km im heutigen Auto und
      ${decimal(input.ev.homePrice * 100)} Cent je kWh zu Hause.</p>

      <div class="tiles">
        <div class="tile"><p class="tile__label">Break-even</p><p class="tile__value">${esc(c.breakEvenYears === null ? `nicht in ${c.years} Jahren` : duration(c.breakEvenYears))}</p><p class="tile__note">${esc(c.breakEvenKm === null ? 'Aufpreis wird nicht eingefahren' : `entspricht ${number(c.breakEvenKm)} km`)}</p></div>
        <div class="tile"><p class="tile__label">Ersparnis im ersten Jahr</p><p class="tile__value">${esc(signedMoney(c.annual.savingsFirstYear))}</p><p class="tile__note">laufende Kosten</p></div>
        <div class="tile"><p class="tile__label">Vorteil nach ${c.years} Jahren</p><p class="tile__value">${esc(signedMoney(c.totalAdvantage))}</p><p class="tile__note">inklusive Restwert</p></div>
      </div>

      ${costTable(c)}
      ${ctaBlock(`/#${esc(encoded || '')}`, 'Dieses Ergebnis weiterrechnen', 'Die Werte sind in der Adresse gespeichert. Im Rechner lassen sie sich Feld für Feld anpassen.')}
      <p class="note">Geteilte Ergebnisse enthalten keine personenbezogenen Daten - nur die
      eingegebenen Rechenwerte, direkt in der Adresse.</p>
    </article>`;

  return layout({
    site,
    path: `/ergebnis/${encoded || ''}`,
    noindex: true,
    title: `${label}: ${c.breakEvenYears === null ? 'kein Break-even' : `Break-even nach ${duration(c.breakEvenYears)}`}`,
    description: verdict,
    body,
  });
}

export function renderSitemap(site) {
  const urls = [
    { path: '/', priority: '1.0', freq: 'weekly' },
    { path: '/e-auto', priority: '0.9', freq: 'weekly' },
    ...KM_PROFILES.map((km) => ({ path: `/fahrprofil/${km}-km`, priority: '0.8', freq: 'monthly' })),
    ...vehicles.map((v) => ({ path: `/e-auto/${v.id}`, priority: '0.7', freq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(site + u.path)}</loc>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;
}

export function renderRobots(site) {
  return `User-agent: *
Allow: /
Disallow: /ergebnis/
Disallow: /admin
Disallow: /api/

Sitemap: ${site}/sitemap.xml
`;
}

/** Nur für Tests: erzwingt ein Neurendern nach Datenänderungen. */
export function clearPageCache() {
  cache.clear();
}
