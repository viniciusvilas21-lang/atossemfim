import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { donationRequestSchema } from "@/lib/validation";
import { computeContributionTotal } from "@/lib/fee";
import { getTransactionFeeCents } from "@/lib/settings";
import { findOrCreateSupporter } from "@/lib/supporters";
import { createCharge, OpenPixApiError, OpenPixConfigError } from "@/lib/openpix/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = donationRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }
  const { amount, coverFee, supporter: supporterInput } = parsed.data;

  const feeCents = await getTransactionFeeCents();
  const { amount: amountOut, fee, totalAmount } = computeContributionTotal(amount, coverFee, feeCents);

  const supporter = await findOrCreateSupporter({
    fullName: supporterInput.fullName,
    whatsapp: supporterInput.whatsapp,
    instagram: supporterInput.instagram,
    email: supporterInput.email,
    allowPublicDisplay: supporterInput.allowPublicDisplay,
    marketingOptIn: supporterInput.marketingOptIn,
  });

  const correlationID = `doacao-${crypto.randomUUID()}`;

  try {
    const { charge } = await createCharge({
      correlationID,
      valueCents: totalAmount,
      comment: "Oferta — Canto da Esperança",
      customer: {
        name: supporter.fullName,
        email: supporter.email,
        correlationID,
      },
    });

    const donation = await prisma.donation.create({
      data: {
        supporterId: supporter.id,
        amount: amountOut,
        fee,
        totalAmount,
        openpixCorrelationId: correlationID,
        openpixChargeId: charge.identifier,
        openpixGlobalId: charge.globalID,
        brCode: charge.brCode,
        qrCodeImage: charge.qrCodeImage,
        paymentLinkUrl: charge.paymentLinkUrl,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      donationId: donation.id,
      amount: donation.amount,
      fee: donation.fee,
      totalAmount: donation.totalAmount,
      brCode: donation.brCode,
      qrCodeImage: donation.qrCodeImage,
      paymentLinkUrl: donation.paymentLinkUrl,
      status: donation.status,
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
