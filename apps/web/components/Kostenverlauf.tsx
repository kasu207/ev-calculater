import { alsEuro } from '@/lib/format';
import { fahrzeugName, referenzName } from '@/lib/ergebnis';
import type { Ergebnis } from '@/lib/ergebnis';

const BREITE = 640;
const HOEHE = 200;
const RAND_Y = 6;
const RAND_X = 7;

type Props = {
  ergebnis: Ergebnis;
  /** Die Linie zeichnet sich nur beim ersten Ergebnis einmal ein. */
  zeichnen: boolean;
};

/** Untergrenze der Achse: eine runde Zahl unter dem niedrigsten Wert der Reihe. */
function untergrenze(kleinster: number): number {
  if (kleinster <= 0) return 0;
  const stufe = kleinster > 20_000 ? 5_000 : 1_000;
  return Math.max(0, Math.floor((kleinster * 0.98) / stufe) * stufe);
}

export function Kostenverlauf({ ergebnis, zeichnen }: Props) {
  const { empfehlung } = ergebnis;
  const reihe = empfehlung.jahresreihe;
  const letztesJahr = reihe[reihe.length - 1]?.jahr ?? 1;

  const alleWerte = reihe.flatMap((punkt) => [punkt.kumuliertElektrisch, punkt.kumuliertVerbrenner]);
  const hoechster = Math.max(...alleWerte);
  const basis = untergrenze(Math.min(...alleWerte));
  const spanne = Math.max(hoechster - basis, 1);

  const x = (jahr: number) => RAND_X + (jahr / letztesJahr) * (BREITE - 2 * RAND_X);
  const y = (wert: number) =>
    HOEHE - RAND_Y - ((wert - basis) / spanne) * (HOEHE - 2 * RAND_Y);

  const pfad = (wertVon: (punkt: (typeof reihe)[number]) => number) =>
    reihe.map((punkt) => `${x(punkt.jahr).toFixed(1)},${y(wertVon(punkt)).toFixed(1)}`).join(' ');

  const breakEven = empfehlung.breakEvenJahr;
  const markeAnteil = breakEven === null ? null : x(breakEven) / BREITE;

  return (
    <figure className="m-0">
      <figcaption className="tabellenschrift mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[14px] text-muted">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-[2px] w-6 bg-ink" />
            {fahrzeugName(ergebnis.fahrzeug)}
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-[2px] w-6"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, var(--muted) 0 5px, transparent 5px 9px)',
              }}
            />
            {referenzName(ergebnis.referenz)}
          </span>
        </span>
        <span className="zahl">bis {alsEuro(hoechster)}</span>
      </figcaption>

      <div className="relative">
        <svg
          className="block h-auto w-full"
          viewBox={`0 0 ${BREITE} ${HOEHE}`}
          style={{ aspectRatio: `${BREITE} / ${HOEHE}` }}
          role="img"
          aria-label={`Kumulierte Kosten über ${letztesJahr} Jahre, elektrisch gegen Verbrenner`}
        >
          {breakEven !== null && (
            <line
              className={zeichnen ? 'marke-erscheint' : ''}
              x1={x(breakEven)}
              x2={x(breakEven)}
              y1={0}
              y2={HOEHE}
              stroke="var(--rule-stark)"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <polyline
            points={pfad((punkt) => punkt.kumuliertVerbrenner)}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            className={zeichnen ? 'linie-zeichnet' : ''}
            pathLength={1}
            points={pfad((punkt) => punkt.kumuliertElektrisch)}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />

          {breakEven !== null && (
            <circle
              className={zeichnen ? 'marke-erscheint' : ''}
              cx={x(breakEven)}
              cy={y(reihe.find((punkt) => punkt.jahr === breakEven)?.kumuliertElektrisch ?? basis)}
              r={4.5}
              fill="var(--signal)"
              stroke="var(--ink)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}

          <line
            x1={0}
            x2={BREITE}
            y1={HOEHE - 1}
            y2={HOEHE - 1}
            stroke="var(--ink)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {markeAnteil !== null && (
          <span
            className="tabellenschrift absolute -top-1 whitespace-nowrap bg-sheet px-1 text-[13px] text-ink"
            style={{
              left: `${markeAnteil * 100}%`,
              transform: markeAnteil > 0.75 ? 'translateX(-100%)' : 'translateX(-6px)',
            }}
          >
            Break-even
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        className="tabellenschrift mt-2 flex justify-between text-[13px] text-muted"
      >
        {reihe.map((punkt) => (
          <span key={punkt.jahr}>{punkt.jahr}</span>
        ))}
      </div>
      <p
        aria-hidden="true"
        className="tabellenschrift mt-1 flex flex-wrap justify-between gap-x-4 text-[13px] text-muted"
      >
        <span>Jahre nach dem Kauf</span>
        <span className="zahl">Achse beginnt bei {alsEuro(basis)}</span>
      </p>

      <table className="nur-fuer-screenreader">
        <caption>Kumulierte Kosten je Jahr</caption>
        <thead>
          <tr>
            <th scope="col">Jahr</th>
            <th scope="col">{fahrzeugName(ergebnis.fahrzeug)}</th>
            <th scope="col">{referenzName(ergebnis.referenz)}</th>
          </tr>
        </thead>
        <tbody>
          {reihe.map((punkt) => (
            <tr key={punkt.jahr}>
              <th scope="row">{punkt.jahr}</th>
              <td>{alsEuro(punkt.kumuliertElektrisch)}</td>
              <td>{alsEuro(punkt.kumuliertVerbrenner)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
