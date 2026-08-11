import { describe, expect, it } from "vitest";
import {
  computeContributionTotal,
  computeFee,
  isValidAmount,
  MIN_AMOUNT_CENTS,
  MAX_AMOUNT_CENTS,
  type FeeFormula,
} from "@/lib/fee";

// OpenPix/Woovi's "Pix Recebido" plan at time of writing: 0,80% per
// transaction, min R$ 0,50, max R$ 5,00.
const WOOVI_PLAN: FeeFormula = { percentageBasisPoints: 80, minCents: 50, maxCents: 500 };

describe("computeFee", () => {
  it("floors small amounts to the minimum fee", () => {
    // 0.80% of R$ 20,00 = R$ 0,16, below the R$ 0,50 floor.
    expect(computeFee(2000, WOOVI_PLAN)).toBe(50);
  });

  it("caps large amounts at the maximum fee", () => {
    // 0.80% of R$ 5.000,00 = R$ 40,00, above the R$ 5,00 ceiling.
    expect(computeFee(500_000, WOOVI_PLAN)).toBe(500);
  });

  it("applies the raw percentage in the un-clamped middle range", () => {
    // 0.80% of R$ 200,00 = R$ 1,60 — between the floor and ceiling.
    expect(computeFee(20_000, WOOVI_PLAN)).toBe(160);
  });
});

describe("computeContributionTotal", () => {
  it("charges only the offer amount when the fee is not covered", () => {
    expect(computeContributionTotal(2000, false, WOOVI_PLAN)).toEqual({
      amount: 2000,
      fee: 0,
      totalAmount: 2000,
    });
  });

  it("adds the computed fee when the supporter opts to cover it", () => {
    expect(computeContributionTotal(2000, true, WOOVI_PLAN)).toEqual({
      amount: 2000,
      fee: 50,
      totalAmount: 2050,
    });
  });

  it("uses whatever formula the admin has configured, not a hardcoded value", () => {
    const customPlan: FeeFormula = { percentageBasisPoints: 150, minCents: 100, maxCents: 900 };
    expect(computeContributionTotal(10_000, true, customPlan)).toEqual({
      amount: 10_000,
      fee: 150,
      totalAmount: 10_150,
    });
  });
});

describe("isValidAmount", () => {
  it("accepts the boundary values", () => {
    expect(isValidAmount(MIN_AMOUNT_CENTS)).toBe(true);
    expect(isValidAmount(MAX_AMOUNT_CENTS)).toBe(true);
  });

  it("rejects amounts outside the allowed range", () => {
    expect(isValidAmount(MIN_AMOUNT_CENTS - 1)).toBe(false);
    expect(isValidAmount(MAX_AMOUNT_CENTS + 1)).toBe(false);
  });

  it("rejects non-integer cents", () => {
    expect(isValidAmount(1000.5)).toBe(false);
  });
});
