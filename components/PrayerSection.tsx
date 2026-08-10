export default function PrayerSection({ prayerGroupUrl }: { prayerGroupUrl: string | null }) {
  return (
    <section className="bg-navy py-14 text-cream">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="font-serif text-2xl font-semibold text-gold-lt sm:text-3xl">
          Interceda em oração
        </h2>
        <p className="mt-3 text-cream/90">
          A oração sustenta a missão. Faça parte da nossa rede de intercessores e acompanhe aquilo
          que Deus está fazendo.
        </p>
        <a
          href={prayerGroupUrl || "#"}
          target={prayerGroupUrl ? "_blank" : undefined}
          rel={prayerGroupUrl ? "noopener noreferrer" : undefined}
          aria-disabled={!prayerGroupUrl}
          className="mt-6 inline-block rounded-full bg-gold px-8 py-3 font-semibold text-navy transition hover:bg-gold-lt aria-disabled:pointer-events-none aria-disabled:opacity-60"
        >
          Entrar no grupo de oração
        </a>
        {!prayerGroupUrl && (
          <p className="mt-2 text-xs text-cream/60">Link do grupo em breve.</p>
        )}
      </div>
    </section>
  );
}
