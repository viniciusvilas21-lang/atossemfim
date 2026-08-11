import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/subscriptions/[id]/status">) {
  const { id } = await ctx.params;
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    select: { status: true, amount: true, fee: true, totalAmount: true, billingDay: true, authorizedAt: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(subscription);
}
