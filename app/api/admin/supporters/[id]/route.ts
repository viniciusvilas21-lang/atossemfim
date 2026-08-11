import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  displayName: z.string().trim().max(150).nullable().optional(),
  carouselOverride: z.enum(["AUTO", "FORCE_SHOW", "FORCE_HIDE"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/supporters/[id]">) {
  return withAdmin(async () => {
    const { id } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const supporter = await prisma.supporter.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ supporter });
  });
}
