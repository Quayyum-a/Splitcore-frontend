"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { KYC_COPY } from "@/lib/kyc-copy";
import type { KycNextStep, KycStatusResponse } from "@/lib/api/types";

import {
  confirmAccountAction,
  resolveAccountAction,
  submitBankDetailsAction,
  verifyIdentityAction,
  type KycActionState,
} from "./actions";

const INITIAL: KycActionState = { error: null };

const STEPS: { key: KycNextStep; label: string }[] = [
  { key: "BANK_DETAILS", label: "Bank details" },
  { key: "RESOLVE_ACCOUNT", label: "Find account" },
  { key: "CONFIRM_ACCOUNT", label: "Confirm name" },
  { key: "VERIFY_IDENTITY", label: "Identity" },
  { key: "DONE", label: "Done" },
];

/**
 * Onboarding, one step at a time.
 *
 * Which step shows is decided entirely by the backend's `nextStep`. The client
 * never works out where someone is in the sequence — there is real money at the
 * end of it, and two places deciding that is one too many.
 */
export function Onboarding({ kyc }: { kyc: KycStatusResponse }) {
  const [editingBank, setEditingBank] = useState(false);
  const copy = KYC_COPY[kyc.status];
  const stepIndex = STEPS.findIndex((s) => s.key === kyc.nextStep);

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-cream">Get paid</h2>
          <p className="mt-1 text-sm text-ink-400">{copy.entertainerDetail}</p>
        </div>
        <StatusPill status={copy.label} tone={copy.tone} />
      </div>

      <StepRail current={stepIndex} />

      {/* The backend's own reason for a failure or a hold. Always worth more
          than anything this screen could invent. */}
      {kyc.failureReason ? (
        <p className="mt-5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm leading-relaxed text-ink-300">
          {kyc.failureReason}
        </p>
      ) : null}

      <div className="mt-5">
        {editingBank || kyc.nextStep === "BANK_DETAILS" ? (
          <BankDetailsStep
            current={kyc}
            onCancel={editingBank ? () => setEditingBank(false) : undefined}
          />
        ) : kyc.nextStep === "RESOLVE_ACCOUNT" ? (
          <ResolveStep kyc={kyc} onChangeBank={() => setEditingBank(true)} />
        ) : kyc.nextStep === "CONFIRM_ACCOUNT" ? (
          <ConfirmStep kyc={kyc} onReject={() => setEditingBank(true)} />
        ) : kyc.nextStep === "VERIFY_IDENTITY" ? (
          <IdentityStep kyc={kyc} />
        ) : (
          <DoneStep kyc={kyc} />
        )}
      </div>
    </section>
  );
}

function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex gap-1.5">
      {STEPS.map((step, index) => {
        const done = current > index;
        const active = current === index;
        return (
          <li key={step.key} className="flex-1">
            <span
              aria-hidden="true"
              className={`block h-1 rounded-full ${
                done ? "bg-gold" : active ? "bg-gold/50" : "bg-ink-700"
              }`}
            />
            <span
              className={`mt-1.5 block text-[0.65rem] ${
                active ? "text-gold" : done ? "text-ink-400" : "text-ink-600"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function BankDetailsStep({
  current,
  onCancel,
}: {
  current: KycStatusResponse;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(submitBankDetailsAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-300">
        Where should your money go? Changing this later clears the checks below, so your
        account can&rsquo;t be swapped after it&rsquo;s been approved.
      </p>

      <Field
        name="bankName"
        label="Bank"
        placeholder="GTBank"
        defaultValue={current.bankName ?? ""}
      />
      <Field
        name="bankCode"
        label="Bank code"
        placeholder="058"
        inputMode="numeric"
        defaultValue={current.bankCode ?? ""}
        hint="The short code your bank uses with Paystack. Your venue can look this up if you're unsure."
      />
      <Field
        name="accountNumber"
        label="Account number"
        placeholder="0123456789"
        inputMode="numeric"
        maxLength={10}
        hint="10 digits."
      />

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex gap-2.5 pt-1">
        <Primary label="Save and continue" pendingLabel="Saving…" />
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-[3.25rem] rounded-2xl border border-ink-700 px-4 text-base font-medium text-ink-300"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ResolveStep({
  kyc,
  onChangeBank,
}: {
  kyc: KycStatusResponse;
  onChangeBank: () => void;
}) {
  const [state, formAction] = useActionState(resolveAccountAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <Summary
        rows={[
          ["Bank", kyc.bankName ?? "—"],
          ["Account", kyc.accountNumberMasked ?? "—"],
        ]}
      />
      <p className="text-sm leading-relaxed text-ink-300">
        We&rsquo;ll ask your bank whose account this is, then show you the name so you can
        check it.
      </p>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex gap-2.5 pt-1">
        <Primary label="Check with my bank" pendingLabel="Checking…" />
        <button
          type="button"
          onClick={onChangeBank}
          className="h-[3.25rem] rounded-2xl border border-ink-700 px-4 text-base font-medium text-ink-300"
        >
          Change
        </button>
      </div>
    </form>
  );
}

/**
 * The fraud checkpoint. The entertainer is shown the name the BANK returned and
 * has to say it's them — the step that makes a payout destination trusted
 * rather than merely typed. It is never auto-confirmed.
 */
function ConfirmStep({
  kyc,
  onReject,
}: {
  kyc: KycStatusResponse;
  onReject: () => void;
}) {
  const [state, formAction] = useActionState(confirmAccountAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="hidden"
        name="confirmedAccountName"
        value={kyc.resolvedAccountName ?? ""}
      />

      <p className="text-sm text-ink-400">Your bank says this account belongs to:</p>
      <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-4 text-center text-xl font-semibold text-gold-bright">
        {kyc.resolvedAccountName ?? "—"}
      </p>
      <Summary
        rows={[
          ["Bank", kyc.bankName ?? "—"],
          ["Account", kyc.accountNumberMasked ?? "—"],
        ]}
      />
      <p className="text-sm leading-relaxed text-ink-300">
        Is that you? Your money will go to this account.
      </p>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="space-y-2.5 pt-1">
        <Primary label="Yes, that's me" pendingLabel="Confirming…" full />
        <button
          type="button"
          onClick={onReject}
          className="h-[3.25rem] w-full rounded-2xl border border-ink-700 text-base font-medium text-ink-300"
        >
          No, that&rsquo;s not me
        </button>
      </div>
    </form>
  );
}

function IdentityStep({ kyc }: { kyc: KycStatusResponse }) {
  const [state, formAction] = useActionState(verifyIdentityAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-300">
        Last step. Your BVN or NIN is sent straight to the verification service and is never
        stored by Splitcore — only whether the check passed.
      </p>

      <div>
        <span className="mb-1.5 block text-xs font-medium tracking-[0.1em] text-ink-400 uppercase">
          Document
        </span>
        <div className="flex gap-2.5">
          {(["BVN", "NIN"] as const).map((type, index) => (
            <label
              key={type}
              className="flex h-[3.25rem] flex-1 cursor-pointer items-center justify-center rounded-2xl border border-ink-700 bg-ink-850 text-base text-ink-300 has-checked:border-gold has-checked:bg-gold/10 has-checked:text-cream"
            >
              <input
                type="radio"
                name="documentType"
                value={type}
                defaultChecked={index === 0}
                className="sr-only"
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <Field
        name="documentNumber"
        label="Number"
        placeholder="11 digits"
        inputMode="numeric"
        maxLength={11}
        autoComplete="off"
      />

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="pt-1">
        <Primary label="Verify me" pendingLabel="Verifying…" full />
      </div>
    </form>
  );
}

function DoneStep({ kyc }: { kyc: KycStatusResponse }) {
  return (
    <div className="space-y-3">
      <Summary
        rows={[
          ["Bank", kyc.bankName ?? "—"],
          ["Account", kyc.accountNumberMasked ?? "—"],
          ["Name", kyc.resolvedAccountName ?? "—"],
          ...(kyc.identityCheckType
            ? ([["Identity", `${kyc.identityCheckType} checked`]] as [string, string][])
            : []),
        ]}
      />
      <p
        className={`text-sm leading-relaxed ${
          kyc.payoutsEnabled ? "text-ink-300" : "text-ink-400"
        }`}
      >
        {kyc.payoutsEnabled
          ? "Your payouts are active. Money from tips goes to this account."
          : "Your details are saved. Payouts switch on once your account is fully cleared."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- primitives */

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-800">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm text-ink-400">{label}</dt>
          <dd className="text-right text-sm font-medium text-cream">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field({
  name,
  label,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-medium tracking-[0.1em] text-ink-400 uppercase"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...rest}
        className="h-[3.25rem] w-full rounded-2xl border border-ink-700 bg-ink-850 px-4 text-base text-cream outline-none placeholder:text-ink-600 focus:border-gold"
      />
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{hint}</p> : null}
    </div>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm leading-relaxed text-danger">
      {children}
    </p>
  );
}

function Primary({
  label,
  pendingLabel,
  full = false,
}: {
  label: string;
  pendingLabel: string;
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-[3.25rem] rounded-2xl bg-gold px-5 text-base font-semibold text-ink-950 disabled:bg-ink-800 disabled:text-ink-600 ${
        full ? "w-full" : "flex-1"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone: "positive" | "neutral" | "warning" | "danger";
}) {
  const tones = {
    positive: "border-success/30 bg-success/10 text-success",
    neutral: "border-ink-700 bg-ink-850 text-ink-300",
    warning: "border-gold/30 bg-gold/10 text-gold",
    danger: "border-danger/30 bg-danger/10 text-danger",
  } as const;
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {status}
    </span>
  );
}
