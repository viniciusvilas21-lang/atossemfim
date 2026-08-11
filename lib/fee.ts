export const MIN_AMOUNT_CENTS = 500; // R$ 5,00
export const MAX_AMOUNT_CENTS = 500_000; // R$ 5.000,00

export const PRESET_AMOUNTS_CENTS = [500, 2000, 5000, 10000, 15000, 20000];

/**
 * OpenPix/Woovi charges a percentage of the transaction, clamped between a
 * minimum and maximum fee (e.g. 0.80%, min R$ 0,50, max R$ 5,00). This
 * mirrors that pricing model so "cobrir a taxa" reflects what the mission
 * actually gets charged, whatever plan is active.
 */
export interface FeeFormula {
  /** basis points, e.g. 80 = 0.80% */
  percentageBasisPoints: number;
  minCents: number;
  maxCents: number;
}

export function computeFee(amountCents: number, formula: FeeFormula): number {
  const raw = Math.round((amountCents * formula.percentageBasisPoints) / 10_000);
  return Math.min(Math.max(raw, formula.minCents), formula.maxCents);
}

export interface ContributionTotal {
  amount: number;
  fee: number;
  totalAmount: number;
}

/** amount is in cents. Pure function, no I/O. */
export function computeContributionTotal(
  amount: number,
  coverFee: boolean,
  feeFormula: FeeFormula,
): ContributionTotal {
  const fee = coverFee ? computeFee(amount, feeFormula) : 0;
  return { amount, fee, totalAmount: amount + fee };
}

export function isValidAmount(amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= MIN_AMOUNT_CENTS &&
    amount <= MAX_AMOUNT_CENTS
  );
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
