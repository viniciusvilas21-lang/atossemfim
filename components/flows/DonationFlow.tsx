"use client";

import { useEffect, useState } from "react";
import AmountStep from "./AmountStep";
import RegistrationStep, { type SupporterFormData } from "./RegistrationStep";
import PixPaymentScreen from "./PixPaymentScreen";

type Step = "amount" | "register" | "pix";

export default function DonationFlow() {
  const [step, setStep] = useState<Step>("amount");
  const [feeCents, setFeeCents] = useState(70);
  const [amount, setAmount] = useState(0);
  const [coverFee, setCoverFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charge, setCharge] = useState<{
    donationId: string;
    totalAmount: number;
    brCode: string | null;
    qrCodeImage: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => setFeeCents(data.feeCents))
      .catch(() => {});
  }, []);

  async function handleRegister(data: SupporterFormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          coverFee,
          supporter: {
            fullName: data.fullName,
            whatsapp: data.whatsapp,
            instagram: data.instagram || undefined,
            email: data.email,
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
            ? "O pagamento via Pix ainda está sendo configurado. Tente novamente em breve."
            : "Não foi possível gerar a cobrança agora. Tente novamente em alguns instantes.",
        );
        return;
      }

      const body = await res.json();
      setCharge({
        donationId: body.donationId,
        totalAmount: body.totalAmount,
        brCode: body.brCode,
        qrCodeImage: body.qrCodeImage,
      });
      setStep("pix");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {step === "amount" && (
        <AmountStep
          feeCents={feeCents}
          monthly={false}
          onContinue={(amt, cover) => {
            setAmount(amt);
            setCoverFee(cover);
            setStep("register");
          }}
        />
      )}
      {step === "register" && (
        <RegistrationStep
          monthly={false}
          submitting={submitting}
          error={error}
          onBack={() => setStep("amount")}
          onSubmit={handleRegister}
        />
      )}
      {step === "pix" && charge && (
        <PixPaymentScreen
          donationId={charge.donationId}
          totalCents={charge.totalAmount}
          brCode={charge.brCode}
          qrCodeImage={charge.qrCodeImage}
        />
      )}
    </div>
  );
}
