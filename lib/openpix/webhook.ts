import { timingSafeEqual } from "node:crypto";

// Confirmed in the current OpenPix webhook docs
// (https://developers.openpix.com.br/docs/webhook/webhook-events-type).
export const CHARGE_COMPLETED = "OPENPIX:CHARGE_COMPLETED";
export const CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER =
  "OPENPIX:CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER";
export const CHARGE_CREATED = "OPENPIX:CHARGE_CREATED";
export const CHARGE_EXPIRED = "OPENPIX:CHARGE_EXPIRED";

// Pix Automático (BACEN) events. OpenPix documents this feature but these six
// event names were supplied by the account holder for their specific OpenPix
// setup — handled here so that, the moment OpenPix's dashboard is configured
// to send them for this account, no code change is needed.
export const PIX_AUTOMATIC_APPROVED = "PIX_AUTOMATIC_APPROVED";
export const PIX_AUTOMATIC_REJECTED = "PIX_AUTOMATIC_REJECTED";
export const PIX_AUTOMATIC_COBR_CREATED = "PIX_AUTOMATIC_COBR_CREATED";
export const PIX_AUTOMATIC_COBR_APPROVED = "PIX_AUTOMATIC_COBR_APPROVED";
export const PIX_AUTOMATIC_COBR_REJECTED = "PIX_AUTOMATIC_COBR_REJECTED";
export const PIX_AUTOMATIC_COBR_COMPLETED = "PIX_AUTOMATIC_COBR_COMPLETED";

/**
 * OpenPix webhooks are registered with a custom `authorization` string
 * (set when creating the webhook, via dashboard or API) and OpenPix echoes
 * that exact value back in the `Authorization` header of every delivery.
 * We compare it with a constant-time check to avoid timing attacks.
 */
export function isValidWebhookAuthorization(headerValue: string | null): boolean {
  const expected = process.env.OPENPIX_WEBHOOK_AUTHORIZATION;
  if (!expected || !headerValue) return false;

  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Builds a stable key so the same webhook delivery (OpenPix retries on
 * timeout/non-2xx) is only ever processed once.
 */
export function buildDedupeKey(eventType: string, resourceId: string | undefined | null): string {
  return `${eventType}:${resourceId ?? "unknown"}`;
}

export interface OpenPixWebhookPayload {
  event?: string;
  charge?: {
    correlationID?: string;
    transactionID?: string;
    status?: string;
    value?: number;
  };
  subscription?: {
    globalID?: string;
    correlationID?: string;
    status?: string;
  };
  pix?: {
    transactionID?: string;
    value?: number;
  };
}

export function extractResourceId(payload: OpenPixWebhookPayload): string | undefined {
  return (
    payload.charge?.correlationID ??
    payload.subscription?.correlationID ??
    payload.subscription?.globalID ??
    payload.pix?.transactionID
  );
}
