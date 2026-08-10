"use client";

import { useState } from "react";
import { formatCPF } from "@/lib/cpf";

export interface SupporterFormData {
  fullName: string;
  whatsapp: string;
  instagram: string;
  email: string;
  cpf: string;
  allowPublicDisplay: boolean;
  acceptPrivacyPolicy: boolean;
  marketingOptIn: boolean;
  billingDay: number | null;
}

const BILLING_DAY_OPTIONS = [1, 5, 10, 15, 20, 25];

export default function RegistrationStep({
  monthly,
  submitting,
  error,
  onSubmit,
  onBack,
}: {
  monthly: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: SupporterFormData) => void;
  onBack: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [allowPublicDisplay, setAllowPublicDisplay] = useState(false);
  const [acceptPrivacyPolicy, setAcceptPrivacyPolicy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [billingDay, setBillingDay] = useState<number | null>(monthly ? 5 : null);
  const [customDay, setCustomDay] = useState("");
  const [useCustomDay, setUseCustomDay] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveDay = useCustomDay ? Number.parseInt(customDay, 10) : billingDay;
    onSubmit({
      fullName,
      whatsapp,
      instagram,
      email,
      cpf,
      allowPublicDisplay,
      acceptPrivacyPolicy,
      marketingOptIn,
      billingDay: monthly ? effectiveDay : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-navy">
          Como podemos identificar sua contribuição?
        </h1>
      </div>

      <Field id="fullName" label="Nome completo" required>
        <input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-gold/40 px-3 py-3"
        />
      </Field>

      <Field id="whatsapp" label="WhatsApp" required>
        <input
          id="whatsapp"
          required
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="w-full rounded-lg border border-gold/40 px-3 py-3"
        />
      </Field>

      <Field id="instagram" label="Instagram (opcional)">
        <input
          id="instagram"
          placeholder="@seuperfil"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="w-full rounded-lg border border-gold/40 px-3 py-3"
        />
      </Field>

      <Field id="email" label="E-mail" required>
        <input
          id="email"
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gold/40 px-3 py-3"
        />
      </Field>

      {monthly && (
        <Field id="cpf" label="CPF" required>
          <input
            id="cpf"
            required
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            maxLength={14}
            className="w-full rounded-lg border border-gold/40 px-3 py-3"
          />
          <p className="mt-1 text-xs text-muted">
            O CPF será utilizado exclusivamente quando necessário para o processo de autorização e
            processamento do Pix Automático. Ele nunca é exibido publicamente.
          </p>
        </Field>
      )}

      {monthly && (
        <div>
          <p className="text-sm font-medium text-ink">Qual é o melhor dia do mês para sua contribuição?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {BILLING_DAY_OPTIONS.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => {
                  setBillingDay(day);
                  setUseCustomDay(false);
                }}
                className={`rounded-xl border px-3 py-2 font-medium ${
                  !useCustomDay && billingDay === day
                    ? "border-gold bg-gold text-navy"
                    : "border-gold/30 bg-white text-navy"
                }`}
              >
                Dia {day}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUseCustomDay(true)}
            className={`mt-2 w-full rounded-xl border px-3 py-2 font-medium ${
              useCustomDay ? "border-gold bg-gold/10 text-navy" : "border-gold/30 bg-white text-navy"
            }`}
          >
            Outro dia
          </button>
          {useCustomDay && (
            <input
              inputMode="numeric"
              placeholder="Dia (1 a 27)"
              value={customDay}
              onChange={(e) => setCustomDay(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gold/40 px-3 py-3"
            />
          )}
        </div>
      )}

      <div className="space-y-3 rounded-2xl bg-navy/5 p-4">
        <Checkbox
          checked={allowPublicDisplay}
          onChange={setAllowPublicDisplay}
          label="Autorizo a divulgação do meu nome como apoiador da missão."
        />
        <Checkbox
          checked={acceptPrivacyPolicy}
          onChange={setAcceptPrivacyPolicy}
          required
          label="Aceito a Política de Privacidade."
        />
        <Checkbox
          checked={marketingOptIn}
          onChange={setMarketingOptIn}
          label="Quero receber atualizações sobre a missão, testemunhos e novidades."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-navy/30 px-5 py-3 font-medium text-navy"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={submitting || !acceptPrivacyPolicy}
          className="flex-1 rounded-full bg-navy px-6 py-3 font-semibold text-gold-lt transition hover:bg-navy-mid disabled:opacity-60"
        >
          {submitting ? "Processando..." : monthly ? "Continuar" : "Ir para o pagamento"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  required,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-ink">
      <input
        type="checkbox"
        required={required}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}
