import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gold/20 bg-navy/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/logo-canto-da-esperanca.svg"
            alt="Canto da Esperança"
            width={120}
            height={40}
            className="h-9 w-auto"
            priority
          />
          <Image
            src="/assets/logo-missao-laco-sem-fim.svg"
            alt="Missão Laço sem Fim"
            width={120}
            height={40}
            className="hidden h-9 w-auto sm:block"
          />
        </Link>
        <a
          href="#apoiar"
          className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-lt"
        >
          Quero apoiar
        </a>
      </div>
    </header>
  );
}
