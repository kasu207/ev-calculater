import type { Metadata } from 'next';
import { RechnerSeite } from '@/components/RechnerSeite';
import { eingabeAusParametern } from '@/lib/parameter';
import { metadatenFuer } from '@/lib/metadaten';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Adresse der geteilten Ergebnisse. Inhaltlich dieselbe Seite wie die
 * Startseite, deshalb zeigt der Canonical-Tag auf die Startseite und die
 * Suchmaschine bekommt nur eine Adresse zu sehen.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const eingabe = eingabeAusParametern(await searchParams);
  return {
    ...metadatenFuer(eingabe, '/'),
    robots: { index: false, follow: true },
  };
}

export default async function RechnerRoute({ searchParams }: Props) {
  return <RechnerSeite eingabe={eingabeAusParametern(await searchParams)} />;
}
