import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/settings";
import { PRESET_AMOUNTS_CENTS, MIN_AMOUNT_CENTS, MAX_AMOUNT_CENTS } from "@/lib/fee";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPublicSettings();
  return NextResponse.json({
    ...settings,
    presetAmountsCents: PRESET_AMOUNTS_CENTS,
    minAmountCents: MIN_AMOUNT_CENTS,
    maxAmountCents: MAX_AMOUNT_CENTS,
  });
}
