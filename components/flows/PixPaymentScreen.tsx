"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/fee";

export default function PixPaymentScreen({
  donationId,
  totalCents,
  brCode,
  qrCodeImage,
}: {
  donationId: string;
  totalCents: number;
  brCode: string | null;
  qrCodeImage: string | null;
}) {
  const [status, setStatus] = useState<"PENDING" | "PAID" | "EXPIRED" | "FAILED">("PENDING");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== "PENDING") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/donations/${donationId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [donationId, status]);

  async function copyPix() {
    if (!brCode) return;
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable — the text is still selectable manually
    }
  }

  if (status === "PAID") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-2xl font-semibold text-navy">Oferta confirmada!</h1>
        <p className="text-ink">
          Muito obrigado por fazer parte desta missão. Deus abençoe sua vida e sua generosidade!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <h1 className="font-serif text-2xl font-semibold text-navy">Finalize sua oferta</h1>
      <p className="text-lg font-semibold text-ink">Valor: {formatBRL(totalCents)}</p>

      {qrCodeImage && (
        <div className="mx-auto w-56 overflow-hidden rounded-2xl border border-gold/30 bg-white p-3">
          {/* OpenPix-hosted QR image */}
          <Image src={qrCodeImage} alt="QR Code Pix" width={224} height={224} unoptimized />
        </div>
      )}

      {brCode && (
        <div className="space-y-2">
          <textarea
            readOnly
            value={brCode}
            className="h-20 w-full resize-none rounded-lg border border-gold/40 p-2 text-xs text-muted"
          />
          <button
            type="button"
            onClick={copyPix}
            className="w-full rounded-full bg-gold px-6 py-3 font-semibold text-navy hover:bg-gold-lt"
          >
            {copied ? "Copiado!" : "Copiar Pix"}
          </button>
        </div>
      )}

      {status === "PENDING" && (
        <p className="text-sm text-muted">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
          Aguardando pagamento...
        </p>
      )}
      {status === "EXPIRED" && (
        <p className="text-sm text-red-600">Essa cobrança expirou. Recarregue a página para gerar outra.</p>
      )}
      {status === "FAILED" && <p className="text-sm text-red-600">Não foi possível confirmar o pagamento.</p>}
    </div>
  );
}
