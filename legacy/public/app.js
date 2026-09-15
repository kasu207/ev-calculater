/**
 * Ablaufsteuerung des Assistenten: Formular erzeugen, Eingaben halten,
 * Backend befragen und Ergebnis darstellen.
 */

import { steps, replacementFields, pricePresets } from './fields.js';
import { money, moneyExact, signedMoney, number, decimal, duration, km } from '../shared/format.js';
import { renderCostLineChart, renderAnnualBars, renderScoreMeter } from './charts.js';
import { leversBlock, shareBlock, leadBlock } from './conversion.js';
import { encodeInput, decodeInput } from '../shared/share.js';

const STORAGE_KEY = 'ev-calculator-input-v1';
const THEME_KEY = 'ev-calculator-theme';

const state = {
  input: null,
  bodyLabels: {},
  step: 0,
  result: null,
  selectedVehicleId: null,
  detail: null,
  selectedComparison: null,
  pending: false,
  // Einstieg über einen geteilten Link - wird für die Messung festgehalten.
  fromSharedLink: false,
};

const $ = (sel) => document.querySelector(sel);

/* ------------------------------------------------------------- Messung */

const tracked = new Set();

/**
 * Cookielose Messung. Ohne Zahlen ist jede Änderung an dieser Seite geraten.
 * Gesendet wird nur der Ereignisname und ein paar kurze Kennwerte, nie eine
 * Eingabe des Nutzers. Fehlschläge werden verschluckt - eine Messung darf
 * die Seite unter keinen Umständen stören.
 */
function track(name, props = {}, { once = false } = {}) {
  if (once) {
    const key = `${name}:${JSON.stringify(props)}`;
    if (tracked.has(key)) return;
    tracked.add(key);
  }
  try {
    const payload = JSON.stringify({ name, props });
    // sendBeacon überlebt einen Seitenwechsel, fetch ist der Rückfallweg.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/event', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    /* Messung ist nie wichtig genug, um etwas kaputtzumachen */
  }
}

/** Aktueller Zustand als teilbarer Link. */
function shareUrl() {
  const code = encodeInput(state.input, state.selectedVehicleId);
  return `${location.origin}/ergebnis${code ? `/${code}` : ''}`;
}

/* ----------------------------------------------------------------- Helfer */

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (typeof acc[key] !== 'object' || acc[key] === null) acc[key] = {};
    return acc[key];
  }, obj);
  target[last] = value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Anfrage fehlgeschlagen (${res.status})`);
  }
  return res.json();
}

/* --------------------------------------------------------------- Formular */

function fieldId(path) {
  return `f-${path.replace(/\./g, '-')}`;
}

function renderField(field) {
  const id = fieldId(field.path);
  const raw = getPath(state.input, field.path);
  const hint = field.hint ? `<small class="field__hint" id="${id}-hint">${escapeHtml(field.hint)}</small>` : '';
  const describedBy = field.hint ? ` aria-describedby="${id}-hint"` : '';

  if (field.type === 'checkbox') {
    return `<div class="field field--checkbox">
        <label for="${id}">
          <input type="checkbox" id="${id}" data-path="${field.path}" data-kind="checkbox" ${raw ? 'checked' : ''}${describedBy} />
          <span>${escapeHtml(field.label)}</span>
        </label>
        ${hint}
      </div>`;
  }

  if (field.type === 'select') {
    const options = field.options
      .map((o) => `<option value="${escapeHtml(o.value)}" ${raw === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
      .join('');
    return `<div class="field">
        <label for="${id}">${escapeHtml(field.label)}</label>
        <select id="${id}" data-path="${field.path}" data-kind="text"${describedBy}>${options}</select>
        ${hint}
      </div>`;
  }

  if (field.type === 'multiselect') {
    const selected = Array.isArray(raw) ? raw : [];
    const chips = field.options
      .map(
        (o) => `<label class="chip ${selected.includes(o.value) ? 'chip--on' : ''}">
            <input type="checkbox" value="${escapeHtml(o.value)}" data-path="${field.path}" data-kind="multiselect" ${selected.includes(o.value) ? 'checked' : ''} />
            <span>${escapeHtml(o.label)}</span>
          </label>`,
      )
      .join('');
    return `<fieldset class="field field--chips">
        <legend>${escapeHtml(field.label)}</legend>
        <div class="chips">${chips}</div>
        ${hint}
      </fieldset>`;
  }

  if (field.type === 'text') {
    return `<div class="field">
        <label for="${id}">${escapeHtml(field.label)}</label>
        <input type="text" id="${id}" data-path="${field.path}" data-kind="text"
          value="${escapeHtml(raw || '')}" placeholder="${escapeHtml(field.placeholder || '')}"${describedBy} />
        ${hint}
      </div>`;
  }

  const isPercent = field.type === 'percent';
  const value = isPercent ? Math.round(Number(raw) * 1000) / 10 : raw;
  const kind = isPercent ? 'percent' : 'number';
  const unit = field.unit ? `<span class="field__unit">${escapeHtml(field.unit)}</span>` : '';

  if (field.control === 'range') {
    return `<div class="field field--range">
        <label for="${id}">${escapeHtml(field.label)}
          <output for="${id}" id="${id}-out">${decimal(value)} ${escapeHtml(field.unit || '')}</output>
        </label>
        <input type="range" id="${id}" data-path="${field.path}" data-kind="${kind}"
          min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"${describedBy} />
        ${hint}
      </div>`;
  }

  return `<div class="field">
      <label for="${id}">${escapeHtml(field.label)}</label>
      <div class="field__input">
        <input type="number" id="${id}" data-path="${field.path}" data-kind="${kind}"
          min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" inputmode="decimal"${describedBy} />
        ${unit}
      </div>
      ${hint}
    </div>`;
}

function scenarioBlock() {
  const isReplace = state.input.scenario === 'replace';
  return `<div class="scenario">
      <h3>Womit soll verglichen werden?</h3>
      <div class="segmented" role="radiogroup" aria-label="Vergleichsszenario">
        <button type="button" role="radio" aria-checked="${!isReplace}" class="segmented__btn ${!isReplace ? 'is-active' : ''}" data-scenario="keep">
          <strong>Auto behalten</strong>
          <small>Ich würde meinen Verbrenner sonst weiterfahren.</small>
        </button>
        <button type="button" role="radio" aria-checked="${isReplace}" class="segmented__btn ${isReplace ? 'is-active' : ''}" data-scenario="replace">
          <strong>Neuwagen steht an</strong>
          <small>Ich kaufe ohnehin ein Auto - Verbrenner oder elektrisch.</small>
        </button>
      </div>
      <p class="scenario__note">
        ${
          isReplace
            ? 'Der Wertverlust fällt in beiden Fällen an. Deshalb entscheiden hier vor allem die laufenden Kosten - das E-Auto liegt meist deutlich früher vorn.'
            : 'Ihr Altauto hat den Großteil seines Wertverlusts hinter sich, das neue E-Auto nicht. Dieser Vergleich ist der strengste - und der ehrlichste, wenn Ihr Auto noch läuft.'
        }
      </p>
      ${
        isReplace
          ? `<div class="grid grid--compact">${replacementFields.map(renderField).join('')}</div>`
          : ''
      }
    </div>`;
}

function activePricePreset() {
  const current = state.input.prices || {};
  return pricePresets.find(
    (preset) =>
      Math.abs(preset.values.fuelGrowth - (current.fuelGrowth ?? 0)) < 1e-9 &&
      Math.abs(preset.values.electricityGrowth - (current.electricityGrowth ?? 0)) < 1e-9,
  );
}

/** Hebt nach einer Direkteingabe die passende Voreinstellung hervor. */
function syncPricePresetState() {
  const active = activePricePreset();
  document.querySelectorAll('[data-price-preset]').forEach((btn) => {
    const on = active?.id === btn.dataset.pricePreset;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', String(on));
  });
}

function pricesBlock() {
  const active = activePricePreset();
  return `<div class="scenario">
      <h3>Wie entwickeln sich die Energiepreise?</h3>
      <div class="segmented" role="radiogroup" aria-label="Preisprognose">
        ${pricePresets
          .map(
            (preset) => `<button type="button" role="radio" aria-checked="${active?.id === preset.id}"
              class="segmented__btn ${active?.id === preset.id ? 'is-active' : ''}" data-price-preset="${escapeHtml(preset.id)}">
              <strong>${escapeHtml(preset.label)}</strong>
              <small>${escapeHtml(preset.hint)}</small>
            </button>`,
          )
          .join('')}
      </div>
      <p class="scenario__note">
        Die Rechnung läuft in heutigen Euro. Tragen Sie deshalb reale Steigerungen ein, also den
        Anteil über der allgemeinen Inflation. Eigene Werte überschreiben die Voreinstellung.
      </p>
    </div>`;
}

function renderWizard() {
  const form = $('#wizard');
  form.innerHTML = steps
    .map((step, index) => {
      const body = step.fields.map(renderField).join('');
      const extra = step.id === 'auto' ? scenarioBlock() : step.id === 'strom' ? pricesBlock() : '';
      return `<section class="step-panel" data-step="${index}" ${index === state.step ? '' : 'hidden'}>
          <header class="step-panel__head">
            <p class="step-panel__count">Schritt ${index + 1} von ${steps.length}</p>
            <h2>${escapeHtml(step.title)}</h2>
            <p class="step-panel__lead">${escapeHtml(step.lead)}</p>
          </header>
          ${extra}
          <div class="grid">${body}</div>
        </section>`;
    })
    .join('');

  renderStepper();
  $('#prevBtn').disabled = state.step === 0;
  $('#nextBtn').textContent = state.step === steps.length - 1 ? 'Ergebnis anzeigen' : 'Weiter';
}

function renderStepper() {
  $('#stepper').innerHTML = steps
    .map(
      (step, i) => `<li>
        <button type="button" class="stepper__btn ${i === state.step ? 'is-active' : ''} ${i < state.step ? 'is-done' : ''}"
          data-goto="${i}" aria-current="${i === state.step ? 'step' : 'false'}">
          <span class="stepper__num">${i + 1}</span>
          <span class="stepper__label">${escapeHtml(step.title)}</span>
        </button>
      </li>`,
    )
    .join('');
}

function goToStep(index) {
  state.step = Math.max(0, Math.min(steps.length - 1, index));
  document.querySelectorAll('.step-panel').forEach((panel) => {
    panel.hidden = Number(panel.dataset.step) !== state.step;
  });
  renderStepper();
  $('#prevBtn').disabled = state.step === 0;
  $('#nextBtn').textContent = state.step === steps.length - 1 ? 'Ergebnis anzeigen' : 'Weiter';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------- Ergebnis */

function verdict(result, selected) {
  const best = selected || result.bestMatch;
  if (!best) {
    return {
      tone: 'warn',
      title: 'Kein Fahrzeug erfüllt Ihre harten Kriterien',
      text: 'Bitte Budget, Sitzplätze oder Anhängelast in Schritt 4 anpassen.',
    };
  }
  const c = best.comparison;
  if (c.breakEvenYears === null) {
    const alt = result.bestEconomy;
    const altHint =
      alt && alt.vehicle.id !== best.vehicle.id && alt.comparison.breakEvenYears !== null
        ? ` Am ehesten rechnet sich der ${alt.label}: Break-even nach ${duration(alt.comparison.breakEvenYears)}.`
        : ' Länger fahren, günstiger laden oder das Szenario "Neuwagen steht an" prüfen kehrt das Bild meist um.';
    return {
      tone: 'warn',
      title: `Innerhalb von ${c.years} Jahren rechnet sich der Umstieg nicht`,
      text: `Nach ${c.years} Jahren fehlen rund ${money(Math.abs(c.totalAdvantage))}. Der größte Posten ist der Wertverlust des Neuwagens.${altHint}`,
    };
  }
  if (c.breakEvenYears <= c.years * 0.5) {
    return {
      tone: 'good',
      title: `Ja - ab ${duration(c.breakEvenYears)} fahren Sie günstiger`,
      text: `Das entspricht rund ${km(c.breakEvenKm)} Fahrleistung. Danach sparen Sie ${
        c.prices.escalating
          ? `laufend ${money(c.annual.savingsFirstYear)} im ersten und ${money(c.annual.savingsLastYear)} im letzten Jahr`
          : `jedes Jahr etwa ${money(c.annual.savings)}`
      }.`,
    };
  }
  return {
    tone: 'ok',
    title: `Ja, aber erst nach ${duration(c.breakEvenYears)}`,
    text: `Der Umstieg lohnt sich, wenn Sie das Fahrzeug mindestens ${Math.ceil(c.breakEvenYears)} Jahre behalten (rund ${km(c.breakEvenKm)}).`,
  };
}

function statTiles(c) {
  const escalating = c.prices.escalating;
  const tiles = [
    {
      label: 'Break-even erreicht nach',
      value: c.breakEvenYears === null ? 'nicht im Zeitraum' : duration(c.breakEvenYears),
      note: c.breakEvenKm === null ? `länger als ${c.years} Jahre` : `entspricht ${km(c.breakEvenKm)}`,
    },
    {
      label: 'Laufende Ersparnis im ersten Jahr',
      value: signedMoney(c.annual.savingsFirstYear),
      note: escalating
        ? `wächst auf ${signedMoney(c.annual.savingsLastYear)} im Jahr ${c.years}, im Mittel ${signedMoney(c.annual.savingsAverage)}`
        : `${money(c.annual.ice.total)} statt ${money(c.annual.ev.total)}`,
    },
    {
      label: `Vorteil nach ${c.years} Jahren`,
      value: signedMoney(c.totalAdvantage),
      note: c.totalAdvantage >= 0 ? 'inklusive Restwert und Kapitalkosten' : 'Rückstand inklusive Restwert',
    },
    {
      label: 'Energiekosten je 100 km',
      value: moneyExact(c.costPer100Ev),
      note: `Verbrenner ${moneyExact(c.costPer100Ice)} - Mischpreis ${decimal(c.kwhPrice * 100)} ct/kWh`,
    },
    {
      label: 'Angenommene Preisentwicklung',
      value: escalating
        ? `${decimal(c.prices.fuelGrowth * 100)} / ${decimal(c.prices.electricityGrowth * 100)} %`
        : 'real konstant',
      note: escalating
        ? `${moneyExact(c.prices.fuelToday)} auf ${moneyExact(c.prices.fuelAtEnd)} je Liter, ${decimal(c.prices.kwhToday * 100)} auf ${decimal(c.prices.kwhAtEnd * 100)} ct/kWh`
        : 'Kraftstoff und Strom steigen nur mit der allgemeinen Inflation',
    },
  ];
  return `<div class="tiles">${tiles
    .map(
      (t) => `<div class="tile">
        <p class="tile__label">${escapeHtml(t.label)}</p>
        <p class="tile__value">${escapeHtml(t.value)}</p>
        <p class="tile__note">${escapeHtml(t.note)}</p>
      </div>`,
    )
    .join('')}</div>`;
}

function dataTable(c) {
  const rows = c.yearly
    .map(
      (d) => `<tr>
        <td>${d.year}</td>
        <td>${number(d.km)}</td>
        <td>${money(d.cumulativeIce)}</td>
        <td>${money(d.cumulativeEv)}</td>
        <td class="${d.advantage >= 0 ? 'pos' : 'neg'}">${signedMoney(d.advantage)}</td>
      </tr>`,
    )
    .join('');
  return `<table class="data-table">
      <caption>Kumulierte Gesamtkosten je Jahr</caption>
      <thead><tr><th>Jahr</th><th>km</th><th>${escapeHtml(c.scenarioLabel)}</th><th>E-Auto</th><th>Vorteil E-Auto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function rankingList(result) {
  return result.ranked
    .map((r) => {
      const c = r.comparison;
      const selected = r.vehicle.id === state.selectedVehicleId;
      const badges = [];
      if (result.bestMatch && r.vehicle.id === result.bestMatch.vehicle.id) badges.push('Beste Gesamtempfehlung');
      if (result.bestEconomy && r.vehicle.id === result.bestEconomy.vehicle.id) badges.push('Wirtschaftlich am schnellsten');
      if (result.cheapestRunning && r.vehicle.id === result.cheapestRunning.vehicle.id) badges.push('Niedrigste Betriebskosten');
      return `<li>
          <button type="button" class="card-vehicle ${selected ? 'is-selected' : ''}" data-vehicle="${escapeHtml(r.vehicle.id)}" aria-pressed="${selected}">
            <span class="card-vehicle__head">
              <span class="card-vehicle__name">${escapeHtml(r.label)}</span>
              <span class="card-vehicle__price">${money(r.vehicle.price)}</span>
            </span>
            <span class="card-vehicle__badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join('')}</span>
            <span class="card-vehicle__meta">
              <span>${number(r.vehicle.rangeKm)} km WLTP &middot; real ca. ${number(r.realRangeKm)} km</span>
              <span>${decimal(r.vehicle.consumptionKwh100)} kWh/100 km &middot; ${number(r.vehicle.dcPeakKw)} kW Ladeleistung</span>
            </span>
            <span class="card-vehicle__score">
              ${renderScoreMeter(r.score)}
              <span class="card-vehicle__scorenum">${decimal(r.score)} / 100</span>
            </span>
            <span class="card-vehicle__break">
              ${
                c.breakEvenYears === null
                  ? `<span class="neg">Kein Break-even in ${c.years} Jahren</span>`
                  : `<span class="pos">Break-even nach ${duration(c.breakEvenYears)}</span>`
              }
              <span class="muted">${signedMoney(c.annual.savingsFirstYear)} laufend im 1. Jahr</span>
            </span>
          </button>
        </li>`;
    })
    .join('');
}

function specList(v) {
  const rows = [
    ['Karosserie', state.bodyLabels[v.body] || v.body],
    ['Listenpreis', money(v.price)],
    ['Batterie', `${decimal(v.batteryKwh)} kWh`],
    ['Reichweite WLTP', `${number(v.rangeKm)} km`],
    ['Verbrauch', `${decimal(v.consumptionKwh100)} kWh/100 km`],
    ['Ladeleistung DC / AC', `${number(v.dcPeakKw)} kW / ${decimal(v.acPeakKw)} kW`],
    ['Sitzplätze', number(v.seats)],
    ['Kofferraum', `${number(v.bootLiters)} l`],
    ['Anhängelast', v.towing ? `${number(v.towing)} kg` : 'nicht vorgesehen'],
    ['Batteriegarantie', `${v.warrantyBatteryYears} Jahre`],
  ];
  return `<dl class="specs">${rows
    .map(([k, val]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(val)}</dd></div>`)
    .join('')}</dl>`;
}

function offersBlock(detail) {
  const { offers, inquiryText } = detail;
  const cards = offers.options
    .map(
      (o) => `<article class="offer">
        <h4>${escapeHtml(o.title)}</h4>
        <p class="offer__headline">${money(o.headline)}<small>${escapeHtml(o.headlineLabel)}</small></p>
        <ul class="offer__assumptions">${o.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
        <p class="offer__pro"><span class="offer__tag offer__tag--pro">Dafür</span>${escapeHtml(o.pro)}</p>
        <p class="offer__contra"><span class="offer__tag offer__tag--contra">Dagegen</span>${escapeHtml(o.contra)}</p>
      </article>`,
    )
    .join('');

  return `<div class="offers">
      <div class="offers__head">
        <h3>Beschaffungswege im Vergleich</h3>
        <p class="note">${escapeHtml(offers.disclaimer)} Angesetzt sind ${Math.round(offers.discountRate * 100)} Prozent Nachlass auf den Listenpreis, also ${money(offers.negotiatedPrice)} statt ${money(offers.listPrice)}.</p>
      </div>
      <div class="offers__grid">${cards}</div>
      <div class="inquiry">
        <div class="inquiry__head">
          <h4>Angebotsanfrage für Ihren Händler</h4>
          <button type="button" class="btn btn--ghost" id="copyInquiry">Text kopieren</button>
        </div>
        <textarea id="inquiryText" rows="14" readonly>${escapeHtml(inquiryText)}</textarea>
      </div>
    </div>`;
}

function detailBlock() {
  if (!state.detail) return '<div class="detail detail--loading">Fahrzeugdetails werden geladen ...</div>';
  const { evaluation } = state.detail;
  const v = evaluation.vehicle;
  const c = evaluation.comparison;

  const partLabels = {
    economy: 'Wirtschaftlichkeit',
    budget: 'Budget',
    range: 'Reichweite',
    practicality: 'Praxistauglichkeit',
    charging: 'Ladegeschwindigkeit',
  };

  return `<div class="detail">
      <header class="detail__head">
        <div>
          <p class="eyebrow">Ausgewähltes Fahrzeug</p>
          <h3>${escapeHtml(evaluation.label)}</h3>
          <p class="detail__note">${escapeHtml(v.note)}</p>
        </div>
        <p class="detail__score"><strong>${decimal(evaluation.score)}</strong><span>von 100 Punkten</span></p>
      </header>

      ${specList(v)}

      <div class="detail__cols">
        <div>
          <h4>Bewertung im Detail</h4>
          <ul class="parts">
            ${Object.entries(evaluation.parts)
              .map(
                ([key, value]) => `<li>
                  <span class="parts__label">${escapeHtml(partLabels[key] || key)}</span>
                  ${renderScoreMeter(value)}
                  <span class="parts__value">${Math.round(value)}</span>
                </li>`,
              )
              .join('')}
          </ul>
        </div>
        <div>
          <h4>Das spricht dafür</h4>
          <ul class="bullets bullets--good">${
            evaluation.highlights.length
              ? evaluation.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')
              : '<li>Keine besonderen Stärken gegenüber den anderen Empfehlungen.</li>'
          }</ul>
          ${
            evaluation.warnings.length
              ? `<h4>Darauf sollten Sie achten</h4>
                 <ul class="bullets bullets--warn">${evaluation.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
              : ''
          }
        </div>
      </div>

      <h4>Jährliche Kosten im Vergleich - erstes Jahr</h4>
      <div class="legend">
        <span class="legend__item"><span class="swatch swatch--ev"></span>E-Auto</span>
        <span class="legend__item"><span class="swatch swatch--ice"></span>${escapeHtml(c.scenarioLabel)}</span>
      </div>
      <div class="chart-wrap" id="annualChart"></div>
      <p class="note">Summe im ersten Jahr: E-Auto ${money(c.annual.ev.total)}, ${escapeHtml(c.scenarioLabel)} ${money(c.annual.ice.total)}. Einmalig kommen beim E-Auto ${money(c.evUpfront)} Anschaffung abzüglich Verkaufserlös hinzu.${
        c.prices.escalating
          ? ` Durch die angenommene Preisentwicklung liegen die Energiekosten im Jahr ${c.years} bei ${money(c.annual.ice.fuel * (c.prices.fuelAtEnd / c.prices.fuelToday))} statt ${money(c.annual.ice.fuel)} für den Verbrenner und bei ${money(c.annual.ev.energy * (c.prices.kwhAtEnd / c.prices.kwhToday))} statt ${money(c.annual.ev.energy)} für das E-Auto.`
          : ''
      }</p>

      ${offersBlock(state.detail)}
    </div>`;
}

function renderResult() {
  const wrap = $('#result');
  const result = state.result;
  if (!result) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  // Kennzahlen, Diagramm und Urteil folgen dem ausgewählten Fahrzeug.
  // Vorbelegt ist die Gesamtempfehlung.
  const recommended = result.bestMatch;
  const best =
    result.ranked.find((r) => r.vehicle.id === state.selectedVehicleId) || recommended;
  state.selectedComparison = best ? best.comparison : null;
  const v = verdict(result, best);
  const counter = result.counterScenario;
  const isRecommended = !!best && !!recommended && best.vehicle.id === recommended.vehicle.id;

  const counterHint =
    counter && best
      ? `<p class="note note--counter">
           Zum Vergleich im Szenario
           <strong>${counter.scenario === 'replace' ? 'Neuwagen steht an' : 'Auto behalten'}</strong>:
           ${
             counter.breakEvenYears === null
               ? `kein Break-even innerhalb des Zeitraums (${signedMoney(counter.totalAdvantage)}).`
               : `Break-even nach ${duration(counter.breakEvenYears)} (${signedMoney(counter.totalAdvantage)}).`
           }
         </p>`
      : '';

  wrap.innerHTML = `
    <div class="result__head">
      <h2>Ihr Ergebnis</h2>
      <div class="segmented segmented--small" role="radiogroup" aria-label="Vergleichsszenario">
        <button type="button" role="radio" aria-checked="${result.scenario === 'keep'}" class="segmented__btn ${result.scenario === 'keep' ? 'is-active' : ''}" data-scenario="keep">Auto behalten</button>
        <button type="button" role="radio" aria-checked="${result.scenario === 'replace'}" class="segmented__btn ${result.scenario === 'replace' ? 'is-active' : ''}" data-scenario="replace">Neuwagen steht an</button>
      </div>
    </div>

    <div class="verdict verdict--${v.tone}">
      <p class="verdict__title">${escapeHtml(v.title)}</p>
      <p class="verdict__text">${escapeHtml(v.text)}</p>
      ${
        best && isRecommended
          ? `<p class="verdict__pick">Empfohlenes Fahrzeug: <strong>${escapeHtml(best.label)}</strong> &middot; ${money(best.vehicle.price)} Listenpreis</p>`
          : best
            ? `<p class="verdict__pick">Angezeigt: <strong>${escapeHtml(best.label)}</strong> &middot; ${money(best.vehicle.price)} Listenpreis.
               Beste Gesamtempfehlung bleibt der ${escapeHtml(recommended.label)}.</p>`
            : ''
      }
      ${counterHint}
    </div>

    ${best ? statTiles(best.comparison) : ''}

    ${
      best
        ? `<section class="panel">
            <div class="panel__head">
              <div>
                <h3>Wann holt der ${escapeHtml(best.label)} auf?</h3>
                <p class="note">Kumulierte Gesamtkosten inklusive Wertverlust, Wallbox, Förderung, Kapitalkosten und Preisentwicklung. Der Schnittpunkt ist der Break-even.${
                  best.comparison.prices.escalating
                    ? ` Angesetzt sind real ${decimal(best.comparison.prices.fuelGrowth * 100)} Prozent pro Jahr auf Kraftstoff und ${decimal(best.comparison.prices.electricityGrowth * 100)} Prozent auf Strom.`
                    : ' Kraftstoff- und Strompreise sind real konstant angesetzt.'
                }</p>
              </div>
              <button type="button" class="btn btn--ghost" id="toggleTable" aria-expanded="false">Als Tabelle</button>
            </div>
            <div class="legend">
              <span class="legend__item"><span class="swatch swatch--ev"></span>E-Auto (${escapeHtml(best.label)})</span>
              <span class="legend__item"><span class="swatch swatch--ice"></span>${escapeHtml(best.comparison.scenarioLabel)}</span>
            </div>
            <div class="chart-wrap chart-wrap--line" id="lineChart"></div>
            <div id="tableView" class="table-scroll" hidden>${dataTable(best.comparison)}</div>
          </section>`
        : ''
    }

    <section class="panel">
      <div class="panel__head">
        <div>
          <h3>Passende E-Autos</h3>
          <p class="note">Sortiert nach Gesamtscore aus Wirtschaftlichkeit, Budget, Reichweite, Praxis und Ladegeschwindigkeit. Rechnerisch benötigte Alltagsreichweite: ${number(result.requiredRangeKm)} km.</p>
        </div>
      </div>
      <ul class="vehicle-list">${rankingList(result)}</ul>
      ${
        result.rejected.length
          ? `<details class="rejected">
               <summary>${result.rejected.length} Fahrzeuge wurden ausgeschlossen</summary>
               <ul>${result.rejected
                 .map((r) => `<li><strong>${escapeHtml(r.label)}</strong> (${money(r.price)}): ${escapeHtml(r.blockers.join(' '))}</li>`)
                 .join('')}</ul>
             </details>`
          : ''
      }
    </section>

    <section class="panel" id="detailPanel">${detailBlock()}</section>

    <div id="leverSlot">${state.detail ? leversBlock(state.detail.levers, state.detail.partners) : ''}</div>

    ${leadBlock(best ? best.label : '')}

    ${shareBlock(shareUrl())}
  `;

  if (best) {
    renderCostLineChart($('#lineChart'), best.comparison);
  }
  if (state.detail) {
    renderAnnualBars($('#annualChart'), state.detail.evaluation.comparison);
  }
}

function renderDetailPanel() {
  const panel = $('#detailPanel');
  if (!panel) return;
  panel.innerHTML = detailBlock();
  if (state.detail) renderAnnualBars($('#annualChart'), state.detail.evaluation.comparison);

  // Die Hebel hängen am ausgewählten Fahrzeug und müssen deshalb mitwandern.
  // Das Fach bleibt beim Neuzeichnen des Ergebnisses stehen, auch wenn die
  // Details noch geladen werden - sonst gibt es beim Nachliefern nichts, in
  // das sie geschrieben werden könnten.
  const slot = $('#leverSlot');
  if (slot && state.detail) {
    slot.innerHTML = leversBlock(state.detail.levers, state.detail.partners);
    track('lever_view', { v: state.selectedVehicleId || '' }, { once: true });
  }

  const share = $('#shareUrl');
  if (share) share.value = shareUrl();
}

let resultObserver = null;

/** Die schwebende Leiste verschwindet, sobald das Ergebnis selbst im Bild ist. */
function observeResultVisibility() {
  const target = $('#result');
  const bar = $('#livebar');
  if (!target || !bar || typeof IntersectionObserver === 'undefined') return;
  resultObserver?.disconnect();
  resultObserver = new IntersectionObserver(
    ([entry]) => bar.classList.toggle('livebar--hidden', entry.isIntersecting),
    { threshold: 0.08 },
  );
  resultObserver.observe(target);
}

function renderLivebar() {
  const bar = $('#livebar');
  const best = state.result?.bestMatch;
  if (!best) {
    bar.hidden = true;
    return;
  }
  const c = best.comparison;
  bar.hidden = false;
  bar.innerHTML = `<button type="button" class="livebar__btn" id="livebarBtn">
      <span class="livebar__label">Aktuelle Empfehlung</span>
      <span class="livebar__vehicle">${escapeHtml(best.label)}</span>
      <span class="livebar__break">${
        c.breakEvenYears === null ? `kein Break-even in ${c.years} Jahren` : `Break-even nach ${duration(c.breakEvenYears)}`
      }</span>
    </button>`;
  observeResultVisibility();
}

/* ------------------------------------------------------------ Berechnung */

async function loadDetail() {
  if (!state.selectedVehicleId) return;
  const wanted = state.selectedVehicleId;
  try {
    const detail = await api('/api/vehicle', {
      vehicleId: wanted,
      input: state.input,
    });
    if (state.selectedVehicleId !== wanted) return;
    state.detail = detail;
    renderDetailPanel();
  } catch (err) {
    state.detail = null;
    const panel = $('#detailPanel');
    if (panel) panel.innerHTML = `<p class="error">Details konnten nicht geladen werden: ${escapeHtml(err.message)}</p>`;
  }
}

async function recompute({ keepSelection = true } = {}) {
  if (state.pending) return;
  state.pending = true;
  try {
    const result = await api('/api/recommend', { input: state.input, limit: 6 });
    state.result = result;

    const ids = result.ranked.map((r) => r.vehicle.id);
    if (!keepSelection || !ids.includes(state.selectedVehicleId)) {
      state.selectedVehicleId = result.bestMatch ? result.bestMatch.vehicle.id : null;
      state.detail = null;
    }
    renderResult();
    renderLivebar();
    persist();
    // Einmal je Sitzung: das Ergebnis ist der Bezugspunkt aller Quoten.
    track('result', { v: state.selectedVehicleId || 'keins' }, { once: true });
    await loadDetail();
  } catch (err) {
    $('#result').hidden = false;
    $('#result').innerHTML = `<p class="error">Berechnung fehlgeschlagen: ${escapeHtml(err.message)}</p>`;
  } finally {
    state.pending = false;
  }
}

const recomputeSoon = debounce(() => recompute(), 250);

/* ---------------------------------------------------------- Persistenz */

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.input));
  } catch {
    /* privater Modus oder voller Speicher - Berechnung läuft trotzdem */
  }
}

function restore(defaults) {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    stored = null;
  }
  const merged = structuredClone(defaults);
  if (stored && typeof stored === 'object') {
    for (const [section, value] of Object.entries(stored)) {
      if (value && typeof value === 'object' && merged[section]) {
        Object.assign(merged[section], value);
      } else if (section in merged) {
        merged[section] = value;
      }
    }
  }
  return merged;
}

/* -------------------------------------------------------------- Ereignisse */

function readControl(target) {
  const kind = target.dataset.kind;
  if (kind === 'checkbox') return target.checked;
  if (kind === 'percent') return Number(target.value) / 100;
  if (kind === 'number') return target.value === '' ? 0 : Number(target.value);
  return target.value;
}

function bindEvents() {
  const form = $('#wizard');

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!target.dataset.path) return;

    if (target.dataset.kind === 'multiselect') return;

    setPath(state.input, target.dataset.path, readControl(target));

    if (target.dataset.path.startsWith('prices.')) syncPricePresetState();

    if (target.type === 'range') {
      const out = document.getElementById(`${target.id}-out`);
      if (out) {
        const field = [...steps.flatMap((s) => s.fields), ...replacementFields].find(
          (f) => f.path === target.dataset.path,
        );
        out.textContent = `${decimal(target.value)} ${field?.unit || ''}`.trim();
      }
    }
    recomputeSoon();
  });

  form.addEventListener('change', (event) => {
    const target = event.target;
    if (target.dataset.kind !== 'multiselect') return;
    const path = target.dataset.path;
    const current = new Set(getPath(state.input, path) || []);
    if (target.checked) current.add(target.value);
    else current.delete(target.value);
    setPath(state.input, path, [...current]);
    target.closest('.chip')?.classList.toggle('chip--on', target.checked);
    recomputeSoon();
  });

  form.addEventListener('click', (event) => {
    const presetBtn = event.target.closest('[data-price-preset]');
    if (presetBtn) {
      const preset = pricePresets.find((item) => item.id === presetBtn.dataset.pricePreset);
      if (preset) {
        Object.assign(state.input.prices, preset.values);
        const activeStep = state.step;
        renderWizard();
        goToStep(activeStep);
        recompute();
      }
      return;
    }

    const btn = event.target.closest('[data-scenario]');
    if (!btn) return;
    state.input.scenario = btn.dataset.scenario;
    const activeStep = state.step;
    renderWizard();
    goToStep(activeStep);
    recompute();
  });

  $('#stepper').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-goto]');
    if (btn) goToStep(Number(btn.dataset.goto));
  });

  $('#prevBtn').addEventListener('click', () => goToStep(state.step - 1));
  $('#nextBtn').addEventListener('click', () => {
    if (state.step === steps.length - 1) {
      recompute().then(() => $('#result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    goToStep(state.step + 1);
  });

  $('#result').addEventListener('click', async (event) => {
    const scenarioBtn = event.target.closest('[data-scenario]');
    if (scenarioBtn) {
      state.input.scenario = scenarioBtn.dataset.scenario;
      renderWizard();
      goToStep(state.step);
      await recompute();
      return;
    }

    const vehicleBtn = event.target.closest('[data-vehicle]');
    if (vehicleBtn) {
      state.selectedVehicleId = vehicleBtn.dataset.vehicle;
      state.detail = null;
      renderResult();
      loadDetail();
      $('#detailPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (event.target.id === 'toggleTable') {
      const view = $('#tableView');
      const chart = $('#lineChart');
      const showTable = view.hidden;
      view.hidden = !showTable;
      chart.hidden = showTable;
      event.target.setAttribute('aria-expanded', String(showTable));
      event.target.textContent = showTable ? 'Als Diagramm' : 'Als Tabelle';
      return;
    }

    if (event.target.id === 'copyInquiry') {
      const textarea = $('#inquiryText');
      const button = event.target;
      try {
        await navigator.clipboard.writeText(textarea.value);
      } catch {
        textarea.select();
        document.execCommand('copy');
      }
      button.textContent = 'Kopiert';
      setTimeout(() => {
        button.textContent = 'Text kopieren';
      }, 2000);
      // Der stärkste Kaufabsichtsindikator, den die Seite kennt.
      track('inquiry_copy', { v: state.selectedVehicleId || '' });
    }
  });

  $('#livebar').addEventListener('click', () => {
    $('#result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#resetBtn').addEventListener('click', async () => {
    localStorage.removeItem(STORAGE_KEY);
    const meta = await api('/api/meta');
    state.input = structuredClone(meta.defaults);
    state.selectedVehicleId = null;
    state.detail = null;
    renderWizard();
    goToStep(0);
    recompute({ keepSelection: false });
  });

  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignorieren */
    }
  });

  window.addEventListener('resize', debounce(() => {
    if (state.selectedComparison && $('#lineChart')) {
      renderCostLineChart($('#lineChart'), state.selectedComparison);
    }
  }, 200));

  bindConversionEvents();
}

/**
 * Alles, was aus dem Ergebnis eine Handlung macht. Die Zuhörer hängen am
 * Dokument, nicht an einzelnen Elementen: das Ergebnis wird bei jeder
 * Eingabe neu gezeichnet, einzeln gebundene Zuhörer wären danach verwaist.
 */
function bindConversionEvents() {
  document.addEventListener('click', async (event) => {
    const partner = event.target.closest('[data-partner]');
    if (partner) {
      // Vor dem Verlassen der Seite messen, sonst geht das Ereignis verloren.
      track('partner_click', { partner: partner.dataset.partner, v: state.selectedVehicleId || '' });
      return;
    }

    if (event.target.closest('#shareBtn')) {
      const url = shareUrl();
      const input = $('#shareUrl');
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Mein E-Auto-Ergebnis', url });
        } else {
          await navigator.clipboard.writeText(url);
        }
        const btn = $('#shareBtn');
        btn.textContent = 'Kopiert';
        setTimeout(() => (btn.textContent = 'Link kopieren'), 2000);
      } catch {
        // Freigabe abgebrochen oder Zwischenablage gesperrt: markieren,
        // dann kann der Nutzer von Hand kopieren.
        input?.select();
      }
      track('share', { v: state.selectedVehicleId || '' });
    }
  });

  // Das Öffnen des Formulars ist der eigentliche Absprungpunkt im Trichter.
  document.addEventListener('focusin', (event) => {
    if (event.target.closest('#leadForm')) {
      track('lead_open', { v: state.selectedVehicleId || '' }, { once: true });
    }
  });

  document.addEventListener('submit', async (event) => {
    if (!event.target.matches('#leadForm')) return;
    event.preventDefault();

    const form = event.target;
    const status = $('#leadStatus');
    const button = $('#leadSubmit');
    const email = form.email.value.trim();

    if (!email.includes('@')) {
      status.textContent = 'Bitte prüfen Sie die E-Mail-Adresse.';
      status.className = 'leadbox__status leadbox__status--error';
      form.email.focus();
      return;
    }
    if (!form.consent.checked) {
      status.textContent = 'Ohne Ihre Einwilligung dürfen wir nichts senden.';
      status.className = 'leadbox__status leadbox__status--error';
      $('#leadConsent').focus();
      return;
    }

    button.disabled = true;
    status.textContent = 'Wird gesendet ...';
    status.className = 'leadbox__status';

    try {
      const purpose = form.querySelector('input[name="purpose"]:checked')?.value || 'result';
      const data = await api('/api/lead', {
        email,
        consent: true,
        purpose,
        vehicleId: state.selectedVehicleId,
        share: encodeInput(state.input, state.selectedVehicleId),
        website: form.website.value,
      });
      status.textContent = data.message || 'Bitte bestätigen Sie den Link in der E-Mail.';
      status.className = 'leadbox__status leadbox__status--ok';
      form.reset();
      track('lead_submit', { purpose, v: state.selectedVehicleId || '' });
    } catch (err) {
      status.textContent = err.message || 'Das hat nicht geklappt. Bitte später erneut versuchen.';
      status.className = 'leadbox__status leadbox__status--error';
    } finally {
      button.disabled = false;
    }
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#themeToggle');
  btn.textContent = theme === 'dark' ? 'Helles Design' : 'Dunkles Design';
  btn.setAttribute('aria-pressed', String(theme === 'dark'));
}

/**
 * Zustand aus der Adresse übernehmen. Zwei Einstiege:
 * - `/?v=modell-id` von einer Landingpage: nur das Fahrzeug vorwählen.
 * - `/#kodierter-zustand` aus einem geteilten Link: alle Werte übernehmen.
 *
 * Ein geteilter Link hat Vorrang vor dem, was im Browser gespeichert liegt -
 * sonst würde der Empfänger fremde Zahlen mit den eigenen vermischt sehen.
 */
function applyUrlState(defaults) {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.replace(/^#/, '');

  if (hash) {
    try {
      const { input, vehicleId } = decodeInput(hash);
      state.input = { ...structuredClone(defaults), ...input };
      if (vehicleId) state.selectedVehicleId = vehicleId;
      state.fromSharedLink = true;
      return;
    } catch {
      /* unbrauchbarer Link: die gespeicherten Werte bleiben bestehen */
    }
  }

  const vehicle = params.get('v');
  if (vehicle && /^[a-z0-9-]{1,40}$/.test(vehicle)) state.selectedVehicleId = vehicle;
}

/* -------------------------------------------------------------------- Start */

async function init() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  } catch {
    applyTheme('light');
  }

  try {
    const meta = await api('/api/meta');
    state.bodyLabels = meta.bodyLabels;
    state.input = restore(meta.defaults);
    applyUrlState(meta.defaults);
    const vintage = $('#dataVintage');
    if (vintage) vintage.textContent = `${meta.dataVintage}, ${meta.vehicleCount} Modelle`;
  } catch (err) {
    document.querySelector('main').insertAdjacentHTML(
      'afterbegin',
      `<p class="error">Der Rechendienst ist nicht erreichbar: ${escapeHtml(err.message)}</p>`,
    );
    return;
  }

  renderWizard();
  bindEvents();
  track('view', { path: location.pathname, shared: state.fromSharedLink ? '1' : '0' });
  await recompute({ keepSelection: Boolean(state.selectedVehicleId) });
}

init();
