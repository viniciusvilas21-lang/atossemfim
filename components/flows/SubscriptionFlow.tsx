"use client";

import { useEffect, useState } from "react";
import AmountStep from "./AmountStep";
import RegistrationStep, { type SupporterFormData } from "./RegistrationStep";
import SubscriptionAuthorizationScreen from "./SubscriptionAuthorizationScreen";
import type { FeeFormula } from "@/lib/fee";

type Step = "amount" | "register" | "authorize";

const DEFAULT_FEE_FORMULA: FeeFormula = { percentageBasisPoints: 80, minCents: 50, maxCents: 500 };

export default function SubscriptionFlow() {
  const [step, setStep] = useState<Step>("amount");
  const [feeFormula, setFeeFormula] = useState<FeeFormula>(DEFAULT_FEE_FORMULA);
  const [amount, setAmount] = useState(0);
  const [coverFee, setCoverFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    subscriptionId: string;
    totalAmount: number;
    billingDay: number;
    authorization: { brCode: string | null; qrCodeImage: string | null; paymentLinkUrl: string | null } | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => setFeeFormula(data.feeFormula))
      .catch(() => {});
  }, []);

  async function handleRegister(data: SupporterFormData) {
    if (!data.billingDay) {
      setError("Escolha o dia do mês para sua contribuição.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          coverFee,
          billingDay: data.billingDay,
          supporter: {
            fullName: data.fullName,
            whatsapp: data.whatsapp,
            instagram: data.instagram || undefined,
            email: data.email,
            cpf: data.cpf,
            allowPublicDisplay: data.allowPublicDisplay,
            acceptPrivacyPolicy: data.acceptPrivacyPolicy,
            marketingOptIn: data.marketingOptIn,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "openpix_not_configured"
            ? "O Pix Automático ainda está sendo configurado. Tente novamente em breve."
            : body.error === "invalid_input"
              ? "Verifique os dados informados, especialmente o CPF."
              : "Não foi possível iniciar sua assinatura agora. Tente novamente em alguns instantes.",
        );
        return;
      }

      const body = await res.json();
      setSubscription({
        subscriptionId: body.subscriptionId,
        totalAmount: body.totalAmount,
        billingDay: body.billingDay,
        authorization: body.authorization,
      });
      setStep("authorize");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {step === "amount" && (
        <AmountStep
          feeFormula={feeFormula}
          monthly
          onContinue={(amt, cover) => {
            setAmount(amt);
            setCoverFee(cover);
            setStep("register");
          }}
        />
      )}
      {step === "register" && (
        <RegistrationStep
          monthly
          submitting={submitting}
          error={error}
          onBack={() => setStep("amount")}
          onSubmit={handleRegister}
        />
      )}
      {step === "authorize" && subscription && (
        <SubscriptionAuthorizationScreen
          subscriptionId={subscription.subscriptionId}
          totalCents={subscription.totalAmount}
          billingDay={subscription.billingDay}
          authorization={subscription.authorization}
        />
      )}
    </div>
  );
}
