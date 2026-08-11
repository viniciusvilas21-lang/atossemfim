import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEligibleForCarousel } from "@/lib/carousel";
import { defaultDisplayName } from "@/lib/supporters";

export const dynamic = "force-dynamic";

export async function GET() {
  const supporters = await prisma.supporter.findMany({
    where: { allowPublicDisplay: true, carouselOverride: { not: "FORCE_HIDE" } },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      carouselOverride: true,
      allowPublicDisplay: true,
      donations: { where: { status: "PAID" }, select: { paidAt: true }, orderBy: { paidAt: "desc" }, take: 1 },
      subscriptions: { where: { status: "ACTIVE" }, select: { authorizedAt: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const eligible = supporters.filter((s) =>
    isEligibleForCarousel({
      allowPublicDisplay: s.allowPublicDisplay,
      carouselOverride: s.carouselOverride,
      hasPaidDonation: s.donations.length > 0,
      hasActiveSubscription: s.subscriptions.length > 0,
    }),
  );

  const names = eligible.map((s) => ({
    id: s.id,
    name: s.displayName || defaultDisplayName(s.fullName),
    type: s.subscriptions.length > 0 ? "mantenedor" : "apoiador",
  }));

  return NextResponse.json({ supporters: names }, { headers: { "Cache-Control": "public, max-age=10" } });
}
