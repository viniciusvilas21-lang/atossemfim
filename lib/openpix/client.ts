// Thin wrapper around the official OpenPix REST API
// (https://developers.openpix.com.br). Credentials only ever live on the
// server, read from environment variables — never sent to the browser.

export class OpenPixConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenPixConfigError";
  }
}

export class OpenPixApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`OpenPix API respondeu ${status}`);
    this.name = "OpenPixApiError";
    this.status = status;
    this.body = body;
  }
}

function getAppId(): string {
  const appId = process.env.OPENPIX_APP_ID;
  if (!appId) {
    throw new OpenPixConfigError(
      "OPENPIX_APP_ID não está configurado. Defina a credencial da OpenPix nas variáveis de ambiente do backend antes de criar cobranças.",
    );
  }
  return appId;
}

function getBaseUrl(): string {
  return process.env.OPENPIX_API_URL?.replace(/\/$/, "") || "https://api.openpix.com.br";
}

async function openpixFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: getAppId(),
      ...init.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new OpenPixApiError(res.status, body);
  }

  return body as T;
}

export interface OpenPixCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  taxID?: string; // CPF/CNPJ, digits only
  correlationID?: string;
}

export interface OpenPixChargeResponse {
  charge: {
    identifier: string;
    correlationID: string;
    paymentLinkID?: string;
    globalID?: string;
    status: string;
    value: number;
    brCode: string;
    qrCodeImage: string;
    paymentLinkUrl?: string;
    expiresIn?: number;
    createdAt: string;
  };
  brCode: string;
}

export async function createCharge(params: {
  correlationID: string;
  valueCents: number;
  comment?: string;
  customer?: OpenPixCustomerInput;
  expiresIn?: number;
}): Promise<OpenPixChargeResponse> {
  return openpixFetch<OpenPixChargeResponse>("/api/v1/charge", {
    method: "POST",
    body: JSON.stringify({
      correlationID: params.correlationID,
      value: params.valueCents,
      comment: params.comment,
      customer: params.customer,
      expiresIn: params.expiresIn,
    }),
  });
}

export async function getChargeByCorrelationId(
  correlationID: string,
): Promise<OpenPixChargeResponse> {
  return openpixFetch<OpenPixChargeResponse>(
    `/api/v1/charge/${encodeURIComponent(correlationID)}`,
    { method: "GET" },
  );
}

export interface OpenPixSubscriptionResponse {
  subscription: {
    globalID: string;
    correlationID?: string;
    value: number;
    dayGenerateCharge: number;
    status: string;
    createdAt: string;
  };
  charge?: OpenPixChargeResponse["charge"];
}

export async function createSubscription(params: {
  correlationID: string;
  valueCents: number;
  dayGenerateCharge: number;
  customer: OpenPixCustomerInput;
}): Promise<OpenPixSubscriptionResponse> {
  return openpixFetch<OpenPixSubscriptionResponse>("/api/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      correlationID: params.correlationID,
      value: params.valueCents,
      dayGenerateCharge: params.dayGenerateCharge,
      customer: params.customer,
    }),
  });
}

export async function getSubscriptionByGlobalId(
  globalID: string,
): Promise<OpenPixSubscriptionResponse> {
  return openpixFetch<OpenPixSubscriptionResponse>(
    `/api/v1/subscriptions/${encodeURIComponent(globalID)}`,
    { method: "GET" },
  );
}
