import { alsEuro } from '@/lib/format';
import { fahrzeugName, verdiktSatz } from '@/lib/ergebnis';
import type { Ergebnis } from '@/lib/ergebnis';

export function Verdikt({ ergebnis }: { ergebnis: Ergebnis }) {
  const { empfehlung } = ergebnis;
  const spart = empfehlung.differenzGesamtEur >= 0;
  const jahre = empfehlung.annahmen.haltedauerJahre;

  return (
    <div>
      <p className="fliesstext text-[19px] leading-snug text-ink">{verdiktSatz(ergebnis)}</p>

      <p
        className="ergebniszahl mt-4 text-[56px] sm:text-[72px]"
        style={{ color: spart ? 'var(--saving)' : 'var(--cost)' }}
      >
        {spart ? '' : '−'}
        {alsEuro(Math.abs(empfehlung.differenzGesamtEur))}
      </p>

      <p className="tabellenschrift mt-1 text-[14px] text-muted">
        {spart ? 'Ersparnis' : 'Mehrkosten'} über {jahre} Jahre, Wertverlust und Betrieb
        zusammen
      </p>

      <p className="tabellenschrift mt-4 text-[14px] text-muted">
        Empfehlung: {fahrzeugName(ergebnis.fahrzeug)} {ergebnis.fahrzeug.variante},{' '}
        {alsEuro(ergebnis.fahrzeug.listenpreisEur)} Listenpreis
      </p>
    </div>
  );
}
