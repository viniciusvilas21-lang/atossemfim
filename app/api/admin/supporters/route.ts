import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const supporters = await prisma.supporter.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        donations: { select: { id: true, status: true, totalAmount: true } },
        subscriptions: { select: { id: true, status: true, totalAmount: true } },
      },
    });
    return NextResponse.json({ supporters });
  });
}
