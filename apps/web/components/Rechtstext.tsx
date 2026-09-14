export function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule py-5">
      <h2 className="m-0 mb-2 text-[17px] font-semibold text-ink">{titel}</h2>
      <div className="fliesstext flex flex-col gap-2 text-[16px] text-ink">{children}</div>
    </section>
  );
}

export function FehlendeAngaben() {
  return (
    <p className="fliesstext m-0 text-[16px] text-cost">
      Die Angaben zum Betreiber sind auf diesem Server noch nicht hinterlegt. Bis sie
      gesetzt sind, darf die Seite nicht öffentlich erreichbar sein.
    </p>
  );
}
