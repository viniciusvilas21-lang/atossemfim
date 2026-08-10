import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/admin/guard";
import { getPublicSettings, setSetting, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const settings = await getPublicSettings();
    return NextResponse.json(settings);
  });
}

const patchSchema = z.object({
  feeCents: z.number().int().min(0).max(10_000).optional(),
  prayerGroupUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function PATCH(request: Request) {
  return withAdmin(async () => {
    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    if (parsed.data.feeCents !== undefined) {
      await setSetting(SETTING_KEYS.transactionFeeCents, String(parsed.data.feeCents));
    }
    if (parsed.data.prayerGroupUrl !== undefined) {
      await setSetting(SETTING_KEYS.prayerGroupUrl, parsed.data.prayerGroupUrl);
    }

    const settings = await getPublicSettings();
    return NextResponse.json(settings);
  });
}
