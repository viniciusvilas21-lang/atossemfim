import { prisma } from "@/lib/prisma";

export interface SupporterInput {
  fullName: string;
  whatsapp: string;
  instagram?: string;
  email: string;
  cpf?: string;
  allowPublicDisplay: boolean;
  marketingOptIn: boolean;
}

/**
 * One Supporter row per e-mail, reused across a one-time donation and a
 * later monthly subscription (or vice-versa). Later submissions refresh the
 * contact details and consents — the newest checkout reflects what the
 * person just told us.
 */
export async function findOrCreateSupporter(input: SupporterInput) {
  const email = input.email.toLowerCase();
  return prisma.supporter.upsert({
    where: { email },
    create: {
      fullName: input.fullName,
      whatsapp: input.whatsapp,
      instagram: input.instagram || null,
      email,
      cpf: input.cpf ?? null,
      allowPublicDisplay: input.allowPublicDisplay,
      marketingOptIn: input.marketingOptIn,
      acceptedPrivacyAt: new Date(),
    },
    update: {
      fullName: input.fullName,
      whatsapp: input.whatsapp,
      instagram: input.instagram || null,
      cpf: input.cpf ?? undefined,
      allowPublicDisplay: input.allowPublicDisplay,
      marketingOptIn: input.marketingOptIn,
      acceptedPrivacyAt: new Date(),
    },
  });
}

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${first} ${lastInitial}.`;
}

export function defaultDisplayName(fullName: string): string {
  return firstNameLastInitial(fullName);
}
