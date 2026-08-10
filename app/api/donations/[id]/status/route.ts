import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Status is always read from our own database, which is only ever updated by
// the OpenPix webhook — the frontend's own claim about payment state is
// never trusted.
export async function GET(_request: Request, ctx: RouteContext<"/api/donations/[id]/status">) {
  const { id } = await ctx.params;
  const donation = await prisma.donation.findUnique({
    where: { id },
    select: { status: true, amount: true, fee: true, totalAmount: true, paidAt: true },
  });
  if (!donation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(donation);
}
