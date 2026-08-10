"use client";

import { useState } from "react";

export default function SettingsForm({
  initialFeeCents,
  initialPrayerGroupUrl,
}: {
  initialFeeCents: number;
  initialPrayerGroupUrl: string;
}) {
  const [feeReais, setFeeReais] = useState((initialFeeCents / 100).toFixed(2));
  const [prayerGroupUrl, setPrayerGroupUrl] = useState(initialPrayerGroupUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const feeCents = Math.round(Number.parseFloat(feeReais.replace(",", ".")) * 100);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeCents, prayerGroupUrl }),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5 rounded-2xl border border-gold/30 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <label className="text-sm font-medium text-ink" htmlFor="fee">
          Taxa da transação (R$)
        </label>
        <input
          id="fee"
          value={feeReais}
          onChange={(e) => setFeeReais(e.target.value)}
          className="w-full rounded-lg border border-gold/40 px-3 py-2"
        />
        <p className="text-xs text-muted">
          Valor acrescentado quando o apoiador escolhe &quot;cobrir a taxa da transação&quot;.
        </p>
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
