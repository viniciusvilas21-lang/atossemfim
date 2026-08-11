import Image from "next/image";

export default function Hero() {
  return (
    <section className="bg-navy text-cream">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12 text-center sm:py-16">
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border-4 border-gold/40 shadow-2xl">
          <Image
            src="/assets/familia-missionaria.webp"
            alt="Família missionária do Canto da Esperança"
            width={1000}
            height={1083}
            className="h-auto w-full"
            priority
          />
        </div>
        <div className="space-y-4">
          <h1 className="font-serif text-3xl font-bold text-gold-lt sm:text-4xl">
            Faça parte desta missão
          </h1>
          <p className="mx-auto max-w-xl text-base text-cream/90 sm:text-lg">
            Quem foi alcançado pela graça entende que também foi chamado a fazer o Reino avançar.
          </p>
        </div>
        <a
          href="#apoiar"
          className="rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy shadow-lg transition hover:bg-gold-lt"
        >
          Quero apoiar
        </a>
      </div>
    </section>
  );
}
