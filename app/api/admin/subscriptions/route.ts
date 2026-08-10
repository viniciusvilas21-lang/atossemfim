import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supporter: { select: { fullName: true, email: true, whatsapp: true, cpf: true } },
        charges: { orderBy: { createdAt: "desc" }, take: 12 },
      },
      take: 500,
    });
    return NextResponse.json({ subscriptions });
  });
}
