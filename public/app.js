/**
 * Ablaufsteuerung des Assistenten: Formular erzeugen, Eingaben halten,
 * Backend befragen und Ergebnis darstellen.
 */

import { steps, replacementFields, pricePresets } from './fields.js';
import { money, moneyExact, signedMoney, number, decimal, duration, durationAfter, km } from './format.js';
import { renderCostLineChart, renderAnnualBars, renderScoreMeter } from './charts.js';

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
  // Welche Feinwert-Bereiche offen sind, überlebt ein Neuzeichnen des Formulars.
  openAdvanced: new Set(),
};

const $ = (sel) => document.querySelector(sel);

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

  // Minus und Plus daneben: auf dem Telefon die schnellste Art, einen Wert
  // zu korrigieren. Die Tastatur bleibt aussen vor, der Fokus im Feld.
  return `<div class="field">
      <label for="${id}">${escapeHtml(field.label)}</label>
      <div class="numberbox">
        <button type="button" class="numberbox__step" data-step-for="${id}" data-dir="-1"
          tabindex="-1" aria-label="${escapeHtml(field.label)}: Wert verringern">&minus;</button>
        <div class="field__input">
          <input type="number" id="${id}" data-path="${field.path}" data-kind="${kind}"
            min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" inputmode="decimal"${describedBy} />
          ${unit}
        </div>
        <button type="button" class="numberbox__step" data-step-for="${id}" data-dir="1"
          tabindex="-1" aria-label="${escapeHtml(field.label)}: Wert erhöhen">+</button>
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

/**
 * Feinwerte eines Schritts. Sie stehen eingeklappt unter den Hauptfeldern,
 * damit ein Schritt auf dem Telefon in wenige Bildschirmhöhen passt.
 */
function advancedBlock(step, fields) {
  return `<details class="advanced" data-advanced="${escapeHtml(step.id)}" ${state.openAdvanced.has(step.id) ? 'open' : ''}>
      <summary>
        <span>${escapeHtml(step.advancedTitle || 'Feinere Annahmen')}</span>
        <span class="advanced__count">${fields.length} Werte</span>
      </summary>
      <div class="grid">${fields.map(renderField).join('')}</div>
    </details>`;
}

function renderWizard() {
  const form = $('#wizard');
  form.innerHTML = steps
    .map((step, index) => {
      const primary = step.fields.filter((f) => !f.advanced);
      const advanced = step.fields.filter((f) => f.advanced);
      const extra = step.id === 'auto' ? scenarioBlock() : step.id === 'strom' ? pricesBlock() : '';
      return `<section class="step-panel" data-step="${index}" ${index === state.step ? '' : 'hidden'}>
          <header class="step-panel__head">
            <h2>${escapeHtml(step.title)}</h2>
            <p class="step-panel__lead">${escapeHtml(step.lead)}</p>
          </header>
          ${extra}
          <div class="grid">${primary.map(renderField).join('')}</div>
          ${advanced.length ? advancedBlock(step, advanced) : ''}
        </section>`;
    })
    .join('');

  renderStepper();
  syncNav();
}

function renderStepper() {
  $('#stepper').innerHTML = steps
    .map(
      (step, i) => `<li>
        <button type="button" class="stepper__btn ${i === state.step ? 'is-active' : ''} ${i < state.step ? 'is-done' : ''}"
          data-goto="${i}" aria-current="${i === state.step ? 'step' : 'false'}"
          aria-label="Schritt ${i + 1}: ${escapeHtml(step.title)}">
          <span class="stepper__num">${i + 1}</span>
          <span class="stepper__label">${escapeHtml(step.short || step.title)}</span>
        </button>
      </li>`,
    )
    .join('');

  const current = steps[state.step];
  const percent = Math.round(((state.step + 1) / steps.length) * 100);
  $('#stepCount').textContent = `Schritt ${state.step + 1} von ${steps.length}`;
  $('#progressBar').style.width = `${percent}%`;
  const progress = $('#progress');
  progress.setAttribute('aria-valuenow', String(percent));
  progress.setAttribute('aria-valuetext', `Schritt ${state.step + 1} von ${steps.length}: ${current.title}`);
}

/** Beschriftung und Zustand der Leiste unten. */
function syncNav() {
  $('#prevBtn').disabled = state.step === 0;
  $('#nextLabel').textContent = state.step === steps.length - 1 ? 'Ergebnis anzeigen' : 'Weiter';
}

function scrollToEl(el) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToStep(index, { scroll = true } = {}) {
  state.step = Math.max(0, Math.min(steps.length - 1, index));
  document.querySelectorAll('.step-panel').forEach((panel) => {
    panel.hidden = Number(panel.dataset.step) !== state.step;
  });
  renderStepper();
  syncNav();
  // Zum Schrittanfang statt zum Seitenanfang: der Kopfbereich muss nicht
  // jedes Mal erneut überscrollt werden.
  if (scroll) scrollToEl($('#wizardShell'));
}

/* --------------------------------------------------------------- Ergebnis */

/**
 * Einheitliche Sprachregelung für den Break-even. Null Monate heisst: der
 * Vorteil steht von Beginn an - das ist kein "Break-even nach 0 Monaten".
 */
function breakEvenPhrase(c) {
  if (c.breakEvenYears === null) return `Kein Break-even in ${c.years} Jahren`;
  if (c.breakEvenMonths === 0) return 'Im Vorteil ab dem ersten Tag';
  return `Break-even nach ${durationAfter(c.breakEvenYears)}`;
}

function verdict(result, selected) {
  const best = selected || result.bestMatch;
  if (!best) {
    return {
      tone: 'warn',
      title: 'Kein Fahrzeug erfüllt Ihre harten Kriterien',
      text: 'Bitte Budget, Sitzplätze oder Anhängelast in Schritt 4 anpassen.',
      figure: null,
    };
  }
  const c = best.comparison;
  if (c.breakEvenYears === null) {
    const alt = result.bestEconomy;
    const altHint =
      alt && alt.vehicle.id !== best.vehicle.id && alt.comparison.breakEvenYears !== null
        ? ` Am ehesten rechnet sich der ${alt.label}: Break-even nach ${durationAfter(alt.comparison.breakEvenYears)}.`
        : ' Länger fahren, günstiger laden oder das Szenario "Neuwagen steht an" prüfen kehrt das Bild meist um.';
    return {
      tone: 'warn',
      title: `Innerhalb von ${c.years} Jahren rechnet sich der Umstieg nicht`,
      text: `Nach ${c.years} Jahren fehlen rund ${money(Math.abs(c.totalAdvantage))}. Der größte Posten ist der Wertverlust des Neuwagens.${altHint}`,
      figure: { value: `über ${c.years} Jahre`, label: 'kein Break-even im Zeitraum' },
    };
  }
  if (c.breakEvenMonths === 0) {
    return {
      tone: 'good',
      title: 'Ja - der Umstieg lohnt sich vom ersten Tag an',
      text: `Förderung und laufende Ersparnis tragen den Mehrpreis von Beginn an. Nach ${c.years} Jahren steht ein Vorteil von ${money(c.totalAdvantage)}.`,
      figure: { value: 'sofort', label: 'im Vorteil ab dem ersten Tag' },
    };
  }
  if (c.breakEvenYears <= c.years * 0.5) {
    return {
      tone: 'good',
      title: `Ja - ab ${durationAfter(c.breakEvenYears)} fahren Sie günstiger`,
      text: `Das entspricht rund ${km(c.breakEvenKm)} Fahrleistung. Danach sparen Sie ${
        c.prices.escalating
          ? `laufend ${money(c.annual.savingsFirstYear)} im ersten und ${money(c.annual.savingsLastYear)} im letzten Jahr`
          : `jedes Jahr etwa ${money(c.annual.savings)}`
      }.`,
      figure: { value: duration(c.breakEvenYears), label: `bis zum Break-even, rund ${km(c.breakEvenKm)}` },
    };
  }
  return {
    tone: 'ok',
    title: `Ja, aber erst nach ${durationAfter(c.breakEvenYears)}`,
    text: `Der Umstieg lohnt sich, wenn Sie das Fahrzeug mindestens ${Math.ceil(c.breakEvenYears)} Jahre behalten (rund ${km(c.breakEvenKm)}).`,
    figure: { value: duration(c.breakEvenYears), label: `bis zum Break-even, rund ${km(c.breakEvenKm)}` },
  };
}

function statTiles(c) {
  const escalating = c.prices.escalating;
  const tiles = [
    {
      label: 'Break-even erreicht nach',
      value: c.breakEvenYears === null ? 'nicht im Zeitraum' : duration(c.breakEvenYears),
      note:
        c.breakEvenYears === null
          ? `länger als ${c.years} Jahre`
          : c.breakEvenMonths === 0
            ? 'Förderung trägt den Mehrpreis von Beginn an'
            : `entspricht ${km(c.breakEvenKm)}`,
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
              <span class="${c.breakEvenYears === null ? 'neg' : 'pos'}">${escapeHtml(breakEvenPhrase(c))}</span>
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
           ${escapeHtml(breakEvenPhrase(counter))} (${signedMoney(counter.totalAdvantage)}).
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
      <div class="verdict__body">
        <p class="eyebrow">${escapeHtml(result.scenario === 'replace' ? 'Neuwagen steht an' : 'Auto behalten')}</p>
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
      ${
        v.figure
          ? `<div class="verdict__figure">
               <span class="verdict__value">${escapeHtml(v.figure.value)}</span>
               <span class="verdict__figure-label">${escapeHtml(v.figure.label)}</span>
             </div>`
          : ''
      }
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

    <section class="panel" id="vehiclePanel">
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
}

let barFrame = 0;

/**
 * Die Leiste unten zeigt, was gerade gebraucht wird: über dem Formular den
 * Zwischenstand und die Schritt-Navigation, ab dem Ergebnis den Weg zurück zu
 * den Angaben und zur Fahrzeugliste. Gemessen wird an der Scrollposition und
 * nicht nur an der Sichtbarkeit, damit die Leiste auch unterhalb des
 * Ergebnisses - etwa im Fußbereich - richtig steht.
 */
function syncActionBar() {
  const result = $('#result');
  const bar = $('#livebar');
  const wizardNav = $('#wizardNav');
  const resultNav = $('#resultNav');
  if (!result || !bar || !wizardNav || !resultNav) return;

  const inResult = !result.hidden && result.getBoundingClientRect().top < window.innerHeight * 0.55;
  bar.classList.toggle('livebar--hidden', inResult);
  wizardNav.hidden = inResult;
  resultNav.hidden = !inResult;
}

function scheduleBarSync() {
  if (barFrame) return;
  barFrame = requestAnimationFrame(() => {
    barFrame = 0;
    syncActionBar();
  });
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
      <span class="livebar__break">${escapeHtml(breakEvenPhrase(c))}</span>
    </button>`;
  syncActionBar();
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
    // Minus/Plus am Zahlenfeld: Wert um eine Schrittweite verschieben und das
    // normale input-Ereignis auslösen, damit die Neuberechnung anläuft.
    const stepBtn = event.target.closest('[data-step-for]');
    if (stepBtn) {
      const input = document.getElementById(stepBtn.dataset.stepFor);
      if (input) {
        const step = Number(input.step) || 1;
        const min = input.min === '' ? -Infinity : Number(input.min);
        const max = input.max === '' ? Infinity : Number(input.max);
        const decimals = (String(step).split('.')[1] || '').length;
        const next = (Number(input.value) || 0) + Number(stepBtn.dataset.dir) * step;
        input.value = String(Math.min(max, Math.max(min, Number(next.toFixed(decimals)))));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Offener Klappbereich bleibt offen, auch wenn das Formular neu entsteht.
    const summary = event.target.closest('.advanced > summary');
    if (summary) {
      const id = summary.parentElement.dataset.advanced;
      if (summary.parentElement.open) state.openAdvanced.delete(id);
      else state.openAdvanced.add(id);
      return;
    }

    const presetBtn = event.target.closest('[data-price-preset]');
    if (presetBtn) {
      const preset = pricePresets.find((item) => item.id === presetBtn.dataset.pricePreset);
      if (preset) {
        Object.assign(state.input.prices, preset.values);
        const activeStep = state.step;
        renderWizard();
        goToStep(activeStep, { scroll: false });
        recompute();
      }
      return;
    }

    const btn = event.target.closest('[data-scenario]');
    if (!btn) return;
    state.input.scenario = btn.dataset.scenario;
    const activeStep = state.step;
    renderWizard();
    goToStep(activeStep, { scroll: false });
    recompute();
  });

  $('#stepper').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-goto]');
    if (btn) goToStep(Number(btn.dataset.goto));
  });

  $('#prevBtn').addEventListener('click', () => goToStep(state.step - 1));
  $('#nextBtn').addEventListener('click', () => {
    if (state.step === steps.length - 1) {
      recompute().then(() => scrollToEl($('#result')));
      return;
    }
    goToStep(state.step + 1);
  });

  // Der Rechner ist von Beginn an mit realistischen Werten belegt. Wer will,
  // springt deshalb sofort zum Ergebnis und verfeinert erst danach.
  $('#startBtn').addEventListener('click', () => goToStep(0));
  $('#quickResultBtn').addEventListener('click', () => scrollToEl($('#result')));
  $('#editBtn').addEventListener('click', () => scrollToEl($('#wizardShell')));
  $('#vehiclesBtn').addEventListener('click', () => scrollToEl($('#vehiclePanel') || $('#result')));

  $('#result').addEventListener('click', async (event) => {
    const scenarioBtn = event.target.closest('[data-scenario]');
    if (scenarioBtn) {
      state.input.scenario = scenarioBtn.dataset.scenario;
      renderWizard();
      goToStep(state.step, { scroll: false });
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
    }
  });

  $('#livebar').addEventListener('click', () => scrollToEl($('#result')));

  // Der Kopfbereich bekommt erst beim Scrollen eine Trennlinie.
  const header = document.querySelector('.site-header');
  const syncHeader = () => header.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener(
    'scroll',
    () => {
      syncHeader();
      scheduleBarSync();
    },
    { passive: true },
  );
  window.addEventListener('resize', scheduleBarSync, { passive: true });
  syncHeader();

  $('#resetBtn').addEventListener('click', async () => {
    localStorage.removeItem(STORAGE_KEY);
    const meta = await api('/api/meta');
    state.input = structuredClone(meta.defaults);
    state.selectedVehicleId = null;
    state.detail = null;
    state.openAdvanced.clear();
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
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#themeToggle');
  const label = theme === 'dark' ? 'Helles Design einschalten' : 'Dunkles Design einschalten';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.setAttribute('aria-pressed', String(theme === 'dark'));
  // Auch die Systemleiste mobiler Browser folgt dem Modus.
  $('#themeColor')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
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
    const vintage = $('#dataVintage');
    if (vintage) vintage.textContent = `${meta.dataVintage}, ${meta.vehicleCount} Modelle`;
    const heroModels = $('#heroModels');
    if (heroModels) heroModels.textContent = `${meta.vehicleCount} Modelle`;
    const heroVintage = $('#heroVintage');
    if (heroVintage) heroVintage.textContent = meta.dataVintage;
  } catch (err) {
    document.querySelector('main').insertAdjacentHTML(
      'afterbegin',
      `<p class="error">Der Rechendienst ist nicht erreichbar: ${escapeHtml(err.message)}</p>`,
    );
    return;
  }

  renderWizard();
  bindEvents();
  await recompute({ keepSelection: false });
}

init();
