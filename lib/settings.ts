import { prisma } from "@/lib/prisma";
import type { FeeFormula } from "@/lib/fee";

export const SETTING_KEYS = {
  feePercentageBasisPoints: "fee_percentage_basis_points",
  feeMinCents: "fee_min_cents",
  feeMaxCents: "fee_max_cents",
  prayerGroupUrl: "prayer_group_url",
} as const;

// Matches OpenPix/Woovi's "Pix Recebido" plan at the time this was written:
// 0,80% por pagamento, mínimo de R$ 0,50, máximo de R$ 5,00. Editable by the
// admin (without a deploy) if the plan changes.
const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.feePercentageBasisPoints]: "80",
  [SETTING_KEYS.feeMinCents]: "50",
  [SETTING_KEYS.feeMaxCents]: "500",
  [SETTING_KEYS.prayerGroupUrl]: "",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

function parseIntSetting(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function getFeeFormula(): Promise<FeeFormula> {
  const [percentageRaw, minRaw, maxRaw] = await Promise.all([
    getSetting(SETTING_KEYS.feePercentageBasisPoints),
    getSetting(SETTING_KEYS.feeMinCents),
    getSetting(SETTING_KEYS.feeMaxCents),
  ]);
  return {
    percentageBasisPoints: parseIntSetting(percentageRaw, 80),
    minCents: parseIntSetting(minRaw, 50),
    maxCents: parseIntSetting(maxRaw, 500),
  };
}

export async function getPublicSettings() {
  const [feeFormula, prayerGroupUrl] = await Promise.all([
    getFeeFormula(),
    getSetting(SETTING_KEYS.prayerGroupUrl),
  ]);
  return { feeFormula, prayerGroupUrl: prayerGroupUrl || null };
}
