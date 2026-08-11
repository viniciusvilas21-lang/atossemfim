"use client";

import { useState } from "react";
import { PRESET_AMOUNTS_CENTS, MIN_AMOUNT_CENTS, MAX_AMOUNT_CENTS, formatBRL } from "@/lib/fee";

export default function AmountStep({
  feeCents,
  monthly,
  onContinue,
}: {
  feeCents: number;
  monthly: boolean;
  onContinue: (amountCents: number, coverFee: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [coverFee, setCoverFee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customCents = Math.round(Number.parseFloat(customValue.replace(",", ".")) * 100);
  const amountCents = showCustom ? customCents : selected;
  const validAmount =
    typeof amountCents === "number" &&
    Number.isFinite(amountCents) &&
    amountCents >= MIN_AMOUNT_CENTS &&
    amountCents <= MAX_AMOUNT_CENTS;

  const fee = coverFee ? feeCents : 0;
  const total = (amountCents || 0) + fee;

  function handleContinue() {
    if (!validAmount) {
      setError(`Escolha um valor entre ${formatBRL(MIN_AMOUNT_CENTS)} e ${formatBRL(MAX_AMOUNT_CENTS)}.`);
      return;
    }
    onContinue(amountCents, coverFee);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy">Faça sua oferta</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha o valor que deseja {monthly ? "contribuir todos os meses" : "ofertar para a missão"}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PRESET_AMOUNTS_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => {
              setSelected(cents);
              setShowCustom(false);
              setError(null);
            }}
            className={`rounded-2xl border px-3 py-4 text-center font-semibold transition ${
              !showCustom && selected === cents
                ? "border-gold bg-gold text-navy"
                : "border-gold/30 bg-white text-navy hover:border-gold"
            }`}
          >
            {formatBRL(cents)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setShowCustom(true);
          setError(null);
        }}
        className={`w-full rounded-2xl border px-3 py-3 text-center font-medium transition ${
          showCustom ? "border-gold bg-gold/10 text-navy" : "border-gold/30 bg-white text-navy hover:border-gold"
        }`}
      >
        Outro valor
      </button>

      {showCustom && (
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="custom-amount">
            Valor (R$)
          </label>
          <input
            id="custom-amount"
            inputMode="decimal"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border border-gold/40 px-3 py-3 text-lg"
          />
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={coverFee}
          onChange={(e) => setCoverFee(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        Quero cobrir a taxa da transação para que a missão receba o valor integral da minha{" "}
        {monthly ? "contribuição" : "oferta"}.
      </label>

      <div className="rounded-2xl bg-navy/5 p-4 text-sm text-ink">
        <div className="flex justify-between">
          <span>{monthly ? "Valor mensal" : "Oferta"}</span>
          <span>{formatBRL(amountCents || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxa</span>
          <span>{formatBRL(fee)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gold/30 pt-1 font-semibold">
          <span>{monthly ? "Total mensal" : "Total"}</span>
          <span>{formatBRL(total)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleContinue}
        className="w-full rounded-full bg-navy px-6 py-4 text-lg font-semibold text-gold-lt transition hover:bg-navy-mid"
      >
        Continuar
      </button>
    </div>
  );
}
