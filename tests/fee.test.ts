import { describe, expect, it } from "vitest";
import { computeContributionTotal, isValidAmount, MIN_AMOUNT_CENTS, MAX_AMOUNT_CENTS } from "@/lib/fee";

describe("computeContributionTotal", () => {
  it("charges only the offer amount when the fee is not covered", () => {
    expect(computeContributionTotal(2000, false, 70)).toEqual({
      amount: 2000,
      fee: 0,
      totalAmount: 2000,
    });
  });

  it("adds the configured fee when the supporter opts to cover it", () => {
    expect(computeContributionTotal(2000, true, 70)).toEqual({
      amount: 2000,
      fee: 70,
      totalAmount: 2070,
    });
  });

  it("uses whatever fee the admin has configured, not a hardcoded value", () => {
    expect(computeContributionTotal(1000, true, 150)).toEqual({
      amount: 1000,
      fee: 150,
      totalAmount: 1150,
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
