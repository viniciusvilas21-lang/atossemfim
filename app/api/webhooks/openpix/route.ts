import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildDedupeKey,
  extractResourceId,
  isValidWebhookAuthorization,
  type OpenPixWebhookPayload,
  CHARGE_COMPLETED,
  CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER,
  CHARGE_CREATED,
  CHARGE_EXPIRED,
  PIX_AUTOMATIC_APPROVED,
  PIX_AUTOMATIC_REJECTED,
  PIX_AUTOMATIC_COBR_CREATED,
  PIX_AUTOMATIC_COBR_APPROVED,
  PIX_AUTOMATIC_COBR_REJECTED,
  PIX_AUTOMATIC_COBR_COMPLETED,
} from "@/lib/openpix/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!isValidWebhookAuthorization(authHeader)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: OpenPixWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = payload.event ?? "UNKNOWN";
  const resourceId = extractResourceId(payload);
  const dedupeKey = buildDedupeKey(eventType, resourceId);

  // Idempotency: if we've already stored (and processed) this exact
  // delivery, acknowledge without reprocessing.
  const existing = await prisma.webhookEvent.findUnique({ where: { dedupeKey } });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const webhookEvent = existing
    ? existing
    : await prisma.webhookEvent.create({
        data: { dedupeKey, eventType, rawPayload: payload as object },
      });

  try {
    const note = await routeEvent(eventType, payload);
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processedAt: new Date(), error: note ?? null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { error: message },
    });
    // Let OpenPix retry on unexpected/transient failures.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

/** Returns an optional human-readable note when the event was a no-op. */
async function routeEvent(eventType: string, payload: OpenPixWebhookPayload): Promise<string | void> {
  switch (eventType) {
    case CHARGE_COMPLETED:
    case CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER:
      return handleChargeCompleted(payload);
    case CHARGE_EXPIRED:
      return handleChargeExpired(payload);
    case CHARGE_CREATED:
      return handleChargeCreated(payload);
    case PIX_AUTOMATIC_APPROVED:
      return handleSubscriptionApproved(payload);
    case PIX_AUTOMATIC_REJECTED:
      return handleSubscriptionRejected(payload);
    case PIX_AUTOMATIC_COBR_CREATED:
      return handleChargeCreated(payload);
    case PIX_AUTOMATIC_COBR_APPROVED:
      return handleSubscriptionChargeAuthorized(payload);
    case PIX_AUTOMATIC_COBR_REJECTED:
      return handleSubscriptionChargeRejected(payload);
    case PIX_AUTOMATIC_COBR_COMPLETED:
      return handleChargeCompleted(payload);
    default:
      return `evento "${eventType}" recebido e registrado, sem ação automática definida`;
  }
}

async function handleChargeCompleted(payload: OpenPixWebhookPayload): Promise<string | void> {
  const correlationId = payload.charge?.correlationID;
  if (!correlationId) return "CHARGE_COMPLETED sem correlationID";

  const donation = await prisma.donation.findUnique({ where: { openpixCorrelationId: correlationId } });
  if (donation) {
    if (donation.status !== "PAID") {
      await prisma.donation.update({
        where: { id: donation.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    return;
  }

  const subscriptionCharge = await prisma.subscriptionCharge.findUnique({
    where: { openpixCorrelationId: correlationId },
  });
  if (subscriptionCharge) {
    await prisma.$transaction([
      prisma.subscriptionCharge.update({
        where: { id: subscriptionCharge.id },
        data: { status: "PAID", paidAt: new Date() },
      }),
      prisma.subscription.updateMany({
        where: { id: subscriptionCharge.subscriptionId, status: { not: "ACTIVE" } },
        data: { status: "ACTIVE", authorizedAt: new Date() },
      }),
    ]);
    return;
  }

  return `CHARGE_COMPLETED para correlationID ${correlationId} sem cobrança correspondente no banco`;
}

async function handleChargeExpired(payload: OpenPixWebhookPayload): Promise<string | void> {
  const correlationId = payload.charge?.correlationID;
  if (!correlationId) return "CHARGE_EXPIRED sem correlationID";

  const donation = await prisma.donation.findUnique({ where: { openpixCorrelationId: correlationId } });
  if (donation) {
    if (donation.status === "PENDING") {
      await prisma.donation.update({ where: { id: donation.id }, data: { status: "EXPIRED" } });
    }
    return;
  }

  const subscriptionCharge = await prisma.subscriptionCharge.findUnique({
    where: { openpixCorrelationId: correlationId },
  });
  if (subscriptionCharge && subscriptionCharge.status !== "PAID") {
    await prisma.subscriptionCharge.update({
      where: { id: subscriptionCharge.id },
      data: { status: "EXPIRED" },
    });
  }
}

/** A new billing cycle was generated (either by us or automatically by OpenPix's subscription engine). */
async function handleChargeCreated(payload: OpenPixWebhookPayload): Promise<string | void> {
  const correlationId = payload.charge?.correlationID;
  if (!correlationId) return "CHARGE_CREATED sem correlationID";

  const alreadyKnownDonation = await prisma.donation.findUnique({
    where: { openpixCorrelationId: correlationId },
  });
  if (alreadyKnownDonation) return; // it's a one-time donation charge we already created ourselves

  const alreadyKnownCharge = await prisma.subscriptionCharge.findUnique({
    where: { openpixCorrelationId: correlationId },
  });
  if (alreadyKnownCharge) return; // already tracked (e.g. the first cycle, created alongside the subscription)

  const subscriptionRef = payload.subscription?.globalID ?? payload.subscription?.correlationID;
  if (!subscriptionRef) {
    return `CHARGE_CREATED (${correlationId}) sem referência de assinatura no payload`;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [{ openpixSubscriptionGlobalId: subscriptionRef }, { openpixCorrelationId: subscriptionRef }],
    },
  });
  if (!subscription) {
    return `CHARGE_CREATED (${correlationId}) referencia assinatura ${subscriptionRef} não encontrada`;
  }

  await prisma.subscriptionCharge.create({
    data: {
      subscriptionId: subscription.id,
      openpixCorrelationId: correlationId,
      amount: payload.charge?.value ?? subscription.totalAmount,
      status: "CREATED",
    },
  });
}

async function findSubscriptionFromPayload(payload: OpenPixWebhookPayload) {
  const ref = payload.subscription?.globalID ?? payload.subscription?.correlationID;
  if (!ref) return null;
  return prisma.subscription.findFirst({
    where: { OR: [{ openpixSubscriptionGlobalId: ref }, { openpixCorrelationId: ref }] },
  });
}

async function handleSubscriptionApproved(payload: OpenPixWebhookPayload): Promise<string | void> {
  const subscription = await findSubscriptionFromPayload(payload);
  if (!subscription) return "PIX_AUTOMATIC_APPROVED sem assinatura correspondente";
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "ACTIVE", authorizedAt: new Date() },
  });
}

async function handleSubscriptionRejected(payload: OpenPixWebhookPayload): Promise<string | void> {
  const subscription = await findSubscriptionFromPayload(payload);
  if (!subscription) return "PIX_AUTOMATIC_REJECTED sem assinatura correspondente";
  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "REJECTED" } });
}

async function handleSubscriptionChargeAuthorized(payload: OpenPixWebhookPayload): Promise<string | void> {
  const correlationId = payload.charge?.correlationID;
  if (!correlationId) return "PIX_AUTOMATIC_COBR_APPROVED sem correlationID";
  const charge = await prisma.subscriptionCharge.findUnique({ where: { openpixCorrelationId: correlationId } });
  if (!charge) return `PIX_AUTOMATIC_COBR_APPROVED (${correlationId}) sem cobrança correspondente`;
  await prisma.subscriptionCharge.update({ where: { id: charge.id }, data: { status: "AUTHORIZED" } });
}

async function handleSubscriptionChargeRejected(payload: OpenPixWebhookPayload): Promise<string | void> {
  const correlationId = payload.charge?.correlationID;
  if (!correlationId) return "PIX_AUTOMATIC_COBR_REJECTED sem correlationID";
  const charge = await prisma.subscriptionCharge.findUnique({ where: { openpixCorrelationId: correlationId } });
  if (!charge) return `PIX_AUTOMATIC_COBR_REJECTED (${correlationId}) sem cobrança correspondente`;
  await prisma.subscriptionCharge.update({ where: { id: charge.id }, data: { status: "FAILED" } });
}
