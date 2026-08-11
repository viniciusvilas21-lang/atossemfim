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
  feePercentageBasisPoints: z.number().int().min(0).max(10_000).optional(),
  feeMinCents: z.number().int().min(0).max(100_000).optional(),
  feeMaxCents: z.number().int().min(0).max(100_000).optional(),
  prayerGroupUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function PATCH(request: Request) {
  return withAdmin(async () => {
    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    if (parsed.data.feePercentageBasisPoints !== undefined) {
      await setSetting(SETTING_KEYS.feePercentageBasisPoints, String(parsed.data.feePercentageBasisPoints));
    }
    if (parsed.data.feeMinCents !== undefined) {
      await setSetting(SETTING_KEYS.feeMinCents, String(parsed.data.feeMinCents));
    }
    if (parsed.data.feeMaxCents !== undefined) {
      await setSetting(SETTING_KEYS.feeMaxCents, String(parsed.data.feeMaxCents));
    }
    if (parsed.data.prayerGroupUrl !== undefined) {
      await setSetting(SETTING_KEYS.prayerGroupUrl, parsed.data.prayerGroupUrl);
    }

    const settings = await getPublicSettings();
    return NextResponse.json(settings);
  });
}
