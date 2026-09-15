/**
 * SVG-Diagramme ohne Fremdbibliothek.
 *
 * Farbregel: Farbe folgt der Entität, nicht dem Rang.
 *   E-Auto     = Serienfarbe 1 (blau)
 *   Verbrenner = Serienfarbe 2 (orange)
 * Diese Zuordnung gilt in allen Diagrammen und in der Legende.
 */

import { money, number, decimal } from '../shared/format.js';

/** Achsenbeschriftung im kompakten Modus: 40.000 EUR wird zu "40 Tsd.". */
function shortMoney(value) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${decimal(value / 1000)} Tsd.`;
  return money(value);
}

/**
 * Auf schmalen Viewports wird eine eigene Geometrie gezeichnet statt das
 * Diagramm nur herunterzuskalieren - sonst schrumpft die Schrift mit.
 */
function isCompact(container) {
  return (container.clientWidth || window.innerWidth || 760) < 560;
}

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

function niceStep(range, targetTicks) {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
  const norm = rough / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Liniendiagramm der kumulierten Gesamtkosten. Der Schnittpunkt beider
 * Linien ist der Break-even.
 */
export function renderCostLineChart(container, comparison, options = {}) {
  container.textContent = '';
  const data = comparison.yearly;
  if (!data || data.length < 2) return;

  const compact = isCompact(container);
  const width = compact ? 430 : 760;
  const height = compact ? 320 : 360;
  const pad = compact
    ? { top: 26, right: 92, bottom: 42, left: 62 }
    : { top: 24, right: 132, bottom: 44, left: 72 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxY = Math.max(...data.map((d) => Math.max(d.cumulativeIce, d.cumulativeEv)));
  const minY = Math.min(0, ...data.map((d) => Math.min(d.cumulativeIce, d.cumulativeEv)));
  const stepY = niceStep(maxY - minY, compact ? 4 : 5);
  const top = Math.ceil(maxY / stepY) * stepY;
  const bottom = Math.floor(minY / stepY) * stepY;

  const maxX = data[data.length - 1].year;
  const x = (year) => pad.left + (year / maxX) * plotW;
  const y = (value) => pad.top + plotH - ((value - bottom) / (top - bottom)) * plotH;

  const svg = el(
    'svg',
    {
      viewBox: `0 0 ${width} ${height}`,
      class: `chart${compact ? ' chart--compact' : ''}`,
      role: 'img',
      'aria-label': `Kumulierte Gesamtkosten über ${maxX} Jahre im Vergleich`,
      preserveAspectRatio: 'xMidYMid meet',
    },
    container,
  );

  // Gitter und Y-Achse - bewusst zurückhaltend.
  for (let v = bottom; v <= top + 0.5; v += stepY) {
    const yy = y(v);
    el('line', { x1: pad.left, x2: pad.left + plotW, y1: yy, y2: yy, class: 'grid-line' }, svg);
    el('text', { x: pad.left - 10, y: yy + 4, class: 'axis-label axis-label--y' }, svg).textContent =
      compact ? shortMoney(v) : money(v);
  }

  // X-Achse
  const xTickStep = compact ? Math.ceil(maxX / 4) : maxX > 10 ? 2 : 1;
  for (let year = 0; year <= maxX; year += xTickStep) {
    el('text', { x: x(year), y: height - pad.bottom + 22, class: 'axis-label axis-label--x' }, svg).textContent =
      year === 0 ? 'heute' : `${year}`;
  }
  el(
    'text',
    { x: pad.left + plotW / 2, y: height - 6, class: 'axis-title' },
    svg,
  ).textContent = 'Jahre ab Umstieg';

  const line = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.year).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  // Break-even-Markierung zuerst, damit die Linien darüber liegen.
  if (comparison.breakEvenYears !== null && comparison.breakEvenYears <= maxX) {
    const bx = x(comparison.breakEvenYears);
    el('line', { x1: bx, x2: bx, y1: pad.top, y2: pad.top + plotH, class: 'breakeven-line' }, svg);
    const labelAnchor = comparison.breakEvenYears > maxX * 0.7 ? 'end' : 'start';
    const label = el(
      'text',
      {
        x: bx + (labelAnchor === 'end' ? -8 : 8),
        y: pad.top + 14,
        class: 'breakeven-label',
        'text-anchor': labelAnchor,
      },
      svg,
    );
    label.textContent = compact
      ? `Break-even ${decimal(comparison.breakEvenYears)} J.`
      : `Break-even nach ${decimal(comparison.breakEvenYears)} Jahren`;
  }

  el('path', { d: line('cumulativeIce'), class: 'series-line series-line--ice' }, svg);
  el('path', { d: line('cumulativeEv'), class: 'series-line series-line--ev' }, svg);

  // Direktbeschriftung am Linienende statt Zahlen an jedem Punkt.
  const lastPoint = data[data.length - 1];
  // Kurzform am Linienende - die Legende ueber dem Diagramm nennt die Langform.
  const endLabels = [
    { key: 'cumulativeEv', text: 'E-Auto', cls: 'end-label--ev' },
    { key: 'cumulativeIce', text: 'Verbrenner', cls: 'end-label--ice' },
  ].sort((a, b) => lastPoint[a.key] - lastPoint[b.key]);

  let lastLabelY = -Infinity;
  for (const item of endLabels) {
    let ly = y(lastPoint[item.key]);
    const minGap = compact ? 34 : 30;
    if (ly - lastLabelY < minGap) ly = lastLabelY + minGap;
    lastLabelY = ly;
    const g = el('g', { class: `end-label ${item.cls}` }, svg);
    el('text', { x: pad.left + plotW + 10, y: ly - 2 }, g).textContent = item.text;
    el('text', { x: pad.left + plotW + 10, y: ly + 14, class: 'end-label__value' }, g).textContent =
      money(lastPoint[item.key]);
  }

  // Hover-Ebene: Fadenkreuz plus Tooltip.
  const hover = el('g', { class: 'hover-layer', opacity: 0 }, svg);
  el('line', { y1: pad.top, y2: pad.top + plotH, class: 'crosshair' }, hover);
  const dotEv = el('circle', { r: 5, class: 'hover-dot hover-dot--ev' }, hover);
  const dotIce = el('circle', { r: 5, class: 'hover-dot hover-dot--ice' }, hover);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const capture = el(
    'rect',
    { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: 'transparent', class: 'capture' },
    svg,
  );

  function pointFromEvent(event) {
    const rect = svg.getBoundingClientRect();
    const scale = width / rect.width;
    const px = (event.clientX - rect.left) * scale;
    const year = ((px - pad.left) / plotW) * maxX;
    const index = Math.max(0, Math.min(data.length - 1, Math.round(year)));
    return data[index];
  }

  function showHover(event) {
    const d = pointFromEvent(event);
    hover.setAttribute('opacity', '1');
    hover.querySelector('.crosshair').setAttribute('x1', x(d.year));
    hover.querySelector('.crosshair').setAttribute('x2', x(d.year));
    dotEv.setAttribute('cx', x(d.year));
    dotEv.setAttribute('cy', y(d.cumulativeEv));
    dotIce.setAttribute('cx', x(d.year));
    dotIce.setAttribute('cy', y(d.cumulativeIce));

    tooltip.hidden = false;
    tooltip.innerHTML = `
      <div class="chart-tooltip__title">Jahr ${d.year} &middot; ${number(d.km)} km</div>
      <div class="chart-tooltip__row"><span class="swatch swatch--ev"></span>E-Auto<b>${money(d.cumulativeEv)}</b></div>
      <div class="chart-tooltip__row"><span class="swatch swatch--ice"></span>${comparison.scenarioLabel}<b>${money(d.cumulativeIce)}</b></div>
      <div class="chart-tooltip__delta">${d.advantage >= 0 ? 'Vorteil E-Auto' : 'Noch im Rückstand'}: ${money(Math.abs(d.advantage))}</div>`;
    const rect = svg.getBoundingClientRect();
    const left = (x(d.year) / width) * rect.width;
    tooltip.style.left = `${Math.min(Math.max(left, 80), rect.width - 80)}px`;
  }

  function hideHover() {
    hover.setAttribute('opacity', '0');
    tooltip.hidden = true;
  }

  capture.addEventListener('pointermove', showHover);
  capture.addEventListener('pointerleave', hideHover);
  if (options.onReady) options.onReady(svg);
}

/**
 * Gruppiertes Balkendiagramm der jährlichen Kostenpositionen.
 * Zwei Balken je Kategorie, Farbe bleibt an der Entität.
 */
export function renderAnnualBars(container, comparison) {
  container.textContent = '';
  const rows = [
    { label: 'Energie', ev: comparison.annual.ev.energy, ice: comparison.annual.ice.fuel },
    { label: 'Versicherung', ev: comparison.annual.ev.insurance, ice: comparison.annual.ice.insurance },
    { label: 'Kfz-Steuer', ev: comparison.annual.ev.tax, ice: comparison.annual.ice.tax },
    { label: 'Wartung', ev: comparison.annual.ev.maintenance, ice: comparison.annual.ice.maintenance },
  ];
  if (comparison.annual.ice.other > 0) {
    rows.push({ label: 'Sonstiges', ev: 0, ice: comparison.annual.ice.other });
  }
  if (comparison.annual.ev.thgBonus < 0) {
    // Gutschrift, keine Kostenposition - wird im Diagramm abgesetzt dargestellt.
    rows.push({ label: 'THG-Bonus', ev: comparison.annual.ev.thgBonus, ice: 0, credit: true });
  }

  const maxValue = Math.max(...rows.map((r) => Math.max(Math.abs(r.ev), Math.abs(r.ice))), 1);
  const compact = isCompact(container);
  const rowH = compact ? 52 : 54;
  const width = compact ? 430 : 720;
  const pad = compact
    ? { left: 112, right: 78, top: 6, bottom: 6 }
    : { left: 132, right: 96, top: 8, bottom: 8 };
  const height = pad.top + rows.length * rowH + pad.bottom;
  const plotW = width - pad.left - pad.right;

  const svg = el(
    'svg',
    {
      viewBox: `0 0 ${width} ${height}`,
      class: `chart chart--bars${compact ? ' chart--compact' : ''}`,
      role: 'img',
      'aria-label': 'Jährliche Kosten nach Position im Vergleich',
      preserveAspectRatio: 'xMidYMid meet',
    },
    container,
  );

  rows.forEach((row, i) => {
    const top = pad.top + i * rowH;
    el('text', { x: pad.left - 12, y: top + 28, class: 'bar-label' }, svg).textContent = row.label;

    const bars = [
      { value: row.ev, cls: 'bar--ev', offset: 4 },
      { value: row.ice, cls: 'bar--ice', offset: 24 },
    ];
    for (const bar of bars) {
      const w = (Math.abs(bar.value) / maxValue) * plotW;
      if (w > 0.5) {
        el(
          'rect',
          {
            x: pad.left,
            y: top + bar.offset,
            width: Math.max(w, 3),
            height: 16,
            rx: 4,
            class: `bar ${bar.cls}${row.credit ? ' bar--credit' : ''}`,
          },
          svg,
        );
      }
      el(
        'text',
        { x: pad.left + Math.max(w, 3) + 10, y: top + bar.offset + 13, class: 'bar-value' },
        svg,
      ).textContent = money(bar.value);
    }
  });

  return svg;
}

/** Kleiner horizontaler Messbalken für die Teilscores. */
export function renderScoreMeter(value) {
  const pct = Math.max(0, Math.min(100, value));
  return `<span class="meter" role="img" aria-label="${Math.round(pct)} von 100 Punkten">
      <span class="meter__fill" style="width:${pct}%"></span>
    </span>`;
}
