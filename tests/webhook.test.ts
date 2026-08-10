import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isValidWebhookAuthorization,
  buildDedupeKey,
  extractResourceId,
  CHARGE_COMPLETED,
} from "@/lib/openpix/webhook";

describe("isValidWebhookAuthorization", () => {
  const ORIGINAL_ENV = process.env.OPENPIX_WEBHOOK_AUTHORIZATION;

  beforeEach(() => {
    process.env.OPENPIX_WEBHOOK_AUTHORIZATION = "expected-secret";
  });

  afterEach(() => {
    process.env.OPENPIX_WEBHOOK_AUTHORIZATION = ORIGINAL_ENV;
  });

  it("accepts the exact configured secret", () => {
    expect(isValidWebhookAuthorization("expected-secret")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isValidWebhookAuthorization("wrong-secret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isValidWebhookAuthorization(null)).toBe(false);
  });

  it("rejects when nothing is configured on the server (never open by default)", () => {
    process.env.OPENPIX_WEBHOOK_AUTHORIZATION = "";
    expect(isValidWebhookAuthorization("anything")).toBe(false);
  });
});

describe("dedupe key + resource extraction", () => {
  // Shape taken from OpenPix's documented CHARGE_COMPLETED webhook payload example.
  const realChargeCompletedPayload = {
    event: CHARGE_COMPLETED,
    charge: {
      status: "COMPLETED",
      customer: { name: "Antonio Victor", correlationID: "4979ceba-2132-4292-bd90-bee7fb2125e4" },
      value: 1000,
      transactionID: "ea83401ed4834b3ea6f1f283b389af29",
      correlationID: "417bae21-3d08-4cdb-9c2d-fee63c89e9e4",
    },
  };

  it("extracts the charge correlationID as the resource id", () => {
    expect(extractResourceId(realChargeCompletedPayload)).toBe("417bae21-3d08-4cdb-9c2d-fee63c89e9e4");
  });

  it("builds a stable, event-scoped dedupe key", () => {
    const key = buildDedupeKey(
      realChargeCompletedPayload.event,
      extractResourceId(realChargeCompletedPayload),
    );
    expect(key).toBe("OPENPIX:CHARGE_COMPLETED:417bae21-3d08-4cdb-9c2d-fee63c89e9e4");
  });

  it("produces the same key for the same delivery replayed twice (idempotency)", () => {
    const first = buildDedupeKey(
      realChargeCompletedPayload.event,
      extractResourceId(realChargeCompletedPayload),
    );
    const second = buildDedupeKey(
      realChargeCompletedPayload.event,
      extractResourceId(realChargeCompletedPayload),
    );
    expect(first).toBe(second);
  });
});
