import { describe, expect, it } from "vitest";
import { isValidCPF, formatCPF, onlyDigits } from "@/lib/cpf";

describe("isValidCPF", () => {
  it("accepts a CPF with a correct check digit", () => {
    // A well-known valid test CPF (passes the real check-digit algorithm).
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224725")).toBe(true);
  });

  it("rejects a CPF with a wrong check digit", () => {
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });

  it("rejects all-repeated-digit sequences", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidCPF("123.456.789")).toBe(false);
  });
});

describe("onlyDigits / formatCPF", () => {
  it("strips non-digits", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });

  it("formats digits back into the canonical mask", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });
});
