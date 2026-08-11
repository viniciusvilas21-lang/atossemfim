export const MIN_AMOUNT_CENTS = 500; // R$ 5,00
export const MAX_AMOUNT_CENTS = 500_000; // R$ 5.000,00

export const PRESET_AMOUNTS_CENTS = [500, 1000, 2000, 3000, 5000, 10000];

export interface ContributionTotal {
  amount: number;
  fee: number;
  totalAmount: number;
}

/** amount and feeCents are both in cents. Pure function, no I/O. */
export function computeContributionTotal(
  amount: number,
  coverFee: boolean,
  feeCents: number,
): ContributionTotal {
  const fee = coverFee ? feeCents : 0;
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
