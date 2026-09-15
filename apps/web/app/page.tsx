import type { Metadata } from 'next';
import { RechnerSeite } from '@/components/RechnerSeite';
import { eingabeAusParametern } from '@/lib/parameter';
import { metadatenFuer } from '@/lib/metadaten';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return metadatenFuer(eingabeAusParametern(await searchParams), '/');
}

export default async function Startseite({ searchParams }: Props) {
  return <RechnerSeite eingabe={eingabeAusParametern(await searchParams)} />;
}
