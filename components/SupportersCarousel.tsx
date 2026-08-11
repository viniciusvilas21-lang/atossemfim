"use client";

import { useEffect, useState } from "react";

interface CarouselSupporter {
  id: string;
  name: string;
  type: "mantenedor" | "apoiador";
}

export default function SupportersCarousel() {
  const [supporters, setSupporters] = useState<CarouselSupporter[] | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/supporters/carousel");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setSupporters(data.supporters);
      } catch {
        // silent — the carousel just keeps its last known state
      }
    }

    load();
    const interval = setInterval(load, 20_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="bg-cream py-10">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center font-serif text-2xl font-semibold text-navy">
          Nossos mantenedores e parceiros
        </h2>

        {supporters === null ? null : supporters.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">
            Seja o primeiro apoiador a fazer parte desta lista!
          </p>
        ) : (
          <div className="relative mt-6 overflow-hidden">
            <div className="flex w-max animate-marquee gap-6">
              {[...supporters, ...supporters].map((s, i) => (
                <span
                  key={`${s.id}-${i}`}
                  className="whitespace-nowrap rounded-full border border-gold/40 bg-white px-5 py-2 text-sm font-medium text-navy shadow-sm"
                >
                  {s.name}
                  <span className="ml-2 text-xs text-gold-dk">
                    {s.type === "mantenedor" ? "mantenedor(a)" : "apoiador(a)"}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
