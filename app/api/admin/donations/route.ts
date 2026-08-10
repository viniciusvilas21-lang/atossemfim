import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const donations = await prisma.donation.findMany({
      orderBy: { createdAt: "desc" },
      include: { supporter: { select: { fullName: true, email: true, whatsapp: true } } },
      take: 500,
    });
    return NextResponse.json({ donations });
  });
}
