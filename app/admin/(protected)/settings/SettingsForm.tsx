"use client";

import { useState } from "react";
import type { FeeFormula } from "@/lib/fee";

export default function SettingsForm({
  initialFeeFormula,
  initialPrayerGroupUrl,
}: {
  initialFeeFormula: FeeFormula;
  initialPrayerGroupUrl: string;
}) {
  const [percentage, setPercentage] = useState((initialFeeFormula.percentageBasisPoints / 100).toString());
  const [minReais, setMinReais] = useState((initialFeeFormula.minCents / 100).toFixed(2));
  const [maxReais, setMaxReais] = useState((initialFeeFormula.maxCents / 100).toFixed(2));
  const [prayerGroupUrl, setPrayerGroupUrl] = useState(initialPrayerGroupUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const feePercentageBasisPoints = Math.round(Number.parseFloat(percentage.replace(",", ".")) * 100);
    const feeMinCents = Math.round(Number.parseFloat(minReais.replace(",", ".")) * 100);
    const feeMaxCents = Math.round(Number.parseFloat(maxReais.replace(",", ".")) * 100);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feePercentageBasisPoints, feeMinCents, feeMaxCents, prayerGroupUrl }),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5 rounded-2xl border border-gold/30 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-ink">Taxa da transação (OpenPix/Woovi)</p>
        <p className="text-xs text-muted">
          Reproduz o plano cobrado pela OpenPix/Woovi: um percentual sobre o valor, com piso e teto.
          Ajuste aqui se o plano da conta mudar.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="percentage">
              Percentual (%)
            </label>
            <input
              id="percentage"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full rounded-lg border border-gold/40 px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="min">
              Mínimo (R$)
            </label>
            <input
              id="min"
              value={minReais}
              onChange={(e) => setMinReais(e.target.value)}
              className="w-full rounded-lg border border-gold/40 px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="max">
              Máximo (R$)
            </label>
            <input
              id="max"
              value={maxReais}
              onChange={(e) => setMaxReais(e.target.value)}
              className="w-full rounded-lg border border-gold/40 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-ink" htmlFor="prayer">
          Link do grupo de oração no WhatsApp
        </label>
        <input
          id="prayer"
          value={prayerGroupUrl}
          onChange={(e) => setPrayerGroupUrl(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="w-full rounded-lg border border-gold/40 px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-full bg-navy px-5 py-2 font-medium text-gold-lt hover:bg-navy-mid disabled:opacity-60"
      >
        {status === "saving" ? "Salvando..." : "Salvar"}
      </button>
      {status === "saved" && <p className="text-sm text-green-700">Configurações salvas.</p>}
      {status === "error" && <p className="text-sm text-red-600">Não foi possível salvar.</p>}
    </form>
  );
}
