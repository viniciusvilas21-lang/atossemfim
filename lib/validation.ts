import { z } from "zod";
import { isValidCPF, onlyDigits } from "@/lib/cpf";
import { isValidAmount } from "@/lib/fee";

const supporterBaseSchema = {
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(150),
  whatsapp: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((v) => v.length >= 10 && v.length <= 13, "WhatsApp inválido."),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido."),
  allowPublicDisplay: z.boolean(),
  acceptPrivacyPolicy: z.literal(true, {
    error: "É necessário aceitar a Política de Privacidade.",
  }),
  marketingOptIn: z.boolean().default(false),
};

export const donationRequestSchema = z.object({
  amount: z.number().int().refine(isValidAmount, "Valor da oferta inválido."),
  coverFee: z.boolean(),
  supporter: z.object(supporterBaseSchema),
});
export type DonationRequestInput = z.infer<typeof donationRequestSchema>;

export const subscriptionRequestSchema = z.object({
  amount: z.number().int().refine(isValidAmount, "Valor da contribuição inválido."),
  coverFee: z.boolean(),
  // OpenPix's dayGenerateCharge accepts 0-27; we only ever offer 1-27 to supporters.
  billingDay: z.number().int().min(1).max(27),
  supporter: z.object({
    ...supporterBaseSchema,
    cpf: z
      .string()
      .trim()
      .transform(onlyDigits)
      .refine(isValidCPF, "CPF inválido."),
  }),
});
export type SubscriptionRequestInput = z.infer<typeof subscriptionRequestSchema>;
