import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  transactionFeeCents: "transaction_fee_cents",
  prayerGroupUrl: "prayer_group_url",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.transactionFeeCents]: "70",
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

export async function getTransactionFeeCents(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.transactionFeeCents);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 70;
}

export async function getPublicSettings() {
  const [feeCents, prayerGroupUrl] = await Promise.all([
    getTransactionFeeCents(),
    getSetting(SETTING_KEYS.prayerGroupUrl),
  ]);
  return { feeCents, prayerGroupUrl: prayerGroupUrl || null };
}
