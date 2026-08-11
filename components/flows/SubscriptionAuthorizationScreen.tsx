"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/fee";

export default function SubscriptionAuthorizationScreen({
  subscriptionId,
  totalCents,
  billingDay,
  authorization,
}: {
  subscriptionId: string;
  totalCents: number;
  billingDay: number;
  authorization: { brCode: string | null; qrCodeImage: string | null; paymentLinkUrl: string | null } | null;
}) {
  const [status, setStatus] = useState<"PENDING_AUTHORIZATION" | "ACTIVE" | "REJECTED" | "CANCELED">(
    "PENDING_AUTHORIZATION",
  );

  useEffect(() => {
    if (status !== "PENDING_AUTHORIZATION") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/subscriptions/${subscriptionId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
      } catch {
        // keep polling
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [subscriptionId, status]);

  if (status === "ACTIVE") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-2xl font-semibold text-navy">Você agora é um mantenedor!</h1>
        <p className="text-ink">
          Muito obrigado por assumir este compromisso com a missão. Seu apoio mensal nos ajuda a
          continuar levando esperança e transformação.
        </p>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-2xl font-semibold text-navy">Autorização não concluída</h1>
        <p className="text-ink">
          Sua instituição financeira não aprovou o Pix Automático. Você pode tentar novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <h1 className="font-serif text-2xl font-semibold text-navy">Autorize seu apoio mensal</h1>
      <p className="text-ink">
        Agora você será direcionado para o fluxo de autorização do Pix Automático. Autorize a
        contribuição diretamente através da instituição financeira.
      </p>

      <div className="rounded-2xl bg-navy/5 p-4 text-left text-sm text-ink">
        <div className="flex justify-between">
          <span>Valor mensal</span>
          <span>{formatBRL(totalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Dia escolhido</span>
          <span>{billingDay}</span>
        </div>
      </div>

      {authorization?.paymentLinkUrl && (
        <a
          href={authorization.paymentLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-navy px-6 py-4 text-lg font-semibold text-gold-lt hover:bg-navy-mid"
        >
          Continuar para autorizar
        </a>
      )}

      {!authorization?.paymentLinkUrl && authorization?.brCode && (
        <p className="text-sm text-muted">
          Use o Pix Copia e Cola abaixo no app do seu banco para concluir a autorização:
          <textarea
            readOnly
            value={authorization.brCode}
            className="mt-2 h-20 w-full resize-none rounded-lg border border-gold/40 p-2 text-xs text-muted"
          />
        </p>
      )}

      <p className="text-sm text-muted">
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
        Aguardando autorização...
      </p>
    </div>
  );
}
