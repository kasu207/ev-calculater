'use client';

import { useId } from 'react';

type Props = {
  name: string;
  /** Wird nur von Screenreadern gelesen: das Feld ist mit seinem Suffix selbst lesbar. */
  beschriftung: string;
  einheit: string;
  wert: number;
  min: number;
  max: number;
  schritt: number;
  onWert: (wert: number) => void;
};

export function EingabeFeld({
  name,
  beschriftung,
  einheit,
  wert,
  min,
  max,
  schritt,
  onWert,
}: Props) {
  const id = useId();

  return (
    <div className="flex-1">
      <label className="nur-fuer-screenreader" htmlFor={id}>
        {beschriftung}
      </label>
      <div className="flex items-baseline gap-2 border border-rule-stark bg-sheet px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink rounded-[var(--radius-control)]">
        <input
          id={id}
          name={name}
          className="zahl w-full min-w-0 border-0 bg-transparent p-0 text-[28px] font-semibold text-ink outline-none"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={schritt}
          value={Number.isFinite(wert) ? wert : ''}
          onChange={(ereignis) => onWert(Number(ereignis.target.value))}
        />
        <span aria-hidden="true" className="tabellenschrift shrink-0 text-[14px] text-muted">
          {einheit}
        </span>
      </div>
    </div>
  );
}
