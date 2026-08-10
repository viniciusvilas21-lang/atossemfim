import Link from "next/link";

export default function SupportChoice() {
  return (
    <section id="apoiar" className="bg-navy-lt/5 py-14">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="font-serif text-2xl font-semibold text-navy sm:text-3xl">
          Como você quer apoiar?
        </h2>
        <p className="mt-2 text-muted">Escolha uma opção para continuar:</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-gold/30 bg-white p-8 shadow-sm">
            <h3 className="font-serif text-xl font-semibold text-navy">Doação única</h3>
            <p className="text-sm text-muted">
              Faça uma oferta agora e ajude diretamente o trabalho missionário.
            </p>
            <Link
              href="/apoiar/unico"
              className="mt-2 w-full rounded-full bg-navy px-6 py-3 font-semibold text-gold-lt transition hover:bg-navy-mid"
            >
              Apoiar uma vez
            </Link>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-3xl border border-gold/30 bg-white p-8 shadow-sm">
            <h3 className="font-serif text-xl font-semibold text-navy">Apoio mensal</h3>
            <p className="text-sm text-muted">
              Torne-se um mantenedor e ajude a sustentar a missão todos os meses.
            </p>
            <Link
              href="/apoiar/mensal"
              className="mt-2 w-full rounded-full bg-gold px-6 py-3 font-semibold text-navy transition hover:bg-gold-lt"
            >
              Ser mantenedor
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
