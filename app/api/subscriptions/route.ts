import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscriptionRequestSchema } from "@/lib/validation";
import { computeContributionTotal } from "@/lib/fee";
import { getTransactionFeeCents } from "@/lib/settings";
import { findOrCreateSupporter } from "@/lib/supporters";
import { onlyDigits } from "@/lib/cpf";
import { createSubscription, OpenPixApiError, OpenPixConfigError } from "@/lib/openpix/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = subscriptionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }
  const { amount, coverFee, billingDay, supporter: supporterInput } = parsed.data;

  const feeCents = await getTransactionFeeCents();
  const { amount: amountOut, fee, totalAmount } = computeContributionTotal(amount, coverFee, feeCents);

  const supporter = await findOrCreateSupporter({
    fullName: supporterInput.fullName,
    whatsapp: supporterInput.whatsapp,
    instagram: supporterInput.instagram,
    email: supporterInput.email,
    cpf: supporterInput.cpf,
    allowPublicDisplay: supporterInput.allowPublicDisplay,
    marketingOptIn: supporterInput.marketingOptIn,
  });

  const correlationID = `assinatura-${crypto.randomUUID()}`;

  try {
    const { subscription: openpixSubscription, charge } = await createSubscription({
      correlationID,
      valueCents: totalAmount,
      dayGenerateCharge: billingDay,
      customer: {
        name: supporter.fullName,
        email: supporter.email,
        taxID: onlyDigits(supporterInput.cpf),
        correlationID,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        supporterId: supporter.id,
        amount: amountOut,
        fee,
        totalAmount,
        billingDay,
        openpixSubscriptionGlobalId: openpixSubscription.globalID,
        openpixCorrelationId: correlationID,
        status: "PENDING_AUTHORIZATION",
      },
    });

    // If OpenPix already returned the first cycle's charge alongside the
    // subscription, track it now so the CHARGE_CREATED webhook for it is a
    // no-op instead of an "unknown charge" note.
    if (charge?.correlationID) {
      await prisma.subscriptionCharge.create({
        data: {
          subscriptionId: subscription.id,
          openpixCorrelationId: charge.correlationID,
          openpixChargeId: charge.identifier,
          amount: totalAmount,
          status: "CREATED",
        },
      });
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      amount: subscription.amount,
      fee: subscription.fee,
      totalAmount: subscription.totalAmount,
      billingDay: subscription.billingDay,
      status: subscription.status,
      // Whatever OpenPix gives us to send the supporter into the bank
      // authorization flow for the first charge.
      authorization: charge
        ? { brCode: charge.brCode, qrCodeImage: charge.qrCodeImage, paymentLinkUrl: charge.paymentLinkUrl }
        : null,
    });
  } catch (err) {
    if (err instanceof OpenPixConfigError) {
      console.error("OpenPix não configurado:", err.message);
      return NextResponse.json({ error: "openpix_not_configured", message: err.message }, { status: 503 });
    }
    if (err instanceof OpenPixApiError) {
      console.error("Erro na API da OpenPix:", err.status, err.body);
      return NextResponse.json({ error: "openpix_error" }, { status: 502 });
    }
    throw err;
  }
}
