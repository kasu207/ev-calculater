import { OFFENLEGUNG } from '@/lib/partner';

/** Provisionshinweis nach Paragraf 5a UWG. Dauerhaft sichtbar, nicht ausklappbar. */
export function Offenlegung({ klasse = '' }: { klasse?: string }) {
  return (
    <p className={`tabellenschrift text-[13px] leading-snug text-muted ${klasse}`}>
      {OFFENLEGUNG}
    </p>
  );
}
