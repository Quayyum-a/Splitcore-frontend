"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { BankPicker } from "@/components/BankPicker";
import type { Bank, VenuePayoutAccount, VenuePayoutStep } from "@/lib/api/types";

import {
  confirmVenueAccountAction,
  resolveVenueAccountAction,
  submitVenueBankDetailsAction,
  type PayoutAccountState,
} from "./actions";

const INITIAL: PayoutAccountState = { error: null };

/**
 * Three steps, then done. No identity check — a venue is a business the
 * platform already onboarded, not a performer who turned up tonight.
 *
 * Which step shows is decided by the backend's derived `nextStep`, exactly as
 * in entertainer onboarding. The two flows share the same response shape by
 * design, so they behave the same way and can't drift apart.
 */
const STEPS: { key: VenuePayoutStep; label: string }[] = [
  { key: "BANK_DETAILS", label: "Bank details" },
  { key: "RESOLVE_ACCOUNT", label: "Find account" },
  { key: "CONFIRM_ACCOUNT", label: "Confirm name" },
  { key: "DONE", label: "Done" },
];

export function PayoutAccountFlow({
  account,
  banks,
}: {
  account: VenuePayoutAccount;
  banks: Bank[] | null;
}) {
  const [editingBank, setEditingBank] = useState(false);
  const stepIndex = STEPS.findIndex((s) => s.key === account.nextStep);

  return (
    <div className="px-5 py-5">
      <StepRail current={stepIndex} />

      <div className="mt-5">
        {editingBank || account.nextStep === "BANK_DETAILS" ? (
          <BankDetailsStep
            account={account}
            banks={banks}
            onCancel={editingBank ? () => setEditingBank(false) : undefined}
          />
        ) : account.nextStep === "RESOLVE_ACCOUNT" ? (
          <ResolveStep account={account} onChangeBank={() => setEditingBank(true)} />
        ) : account.nextStep === "CONFIRM_ACCOUNT" ? (
          <ConfirmStep account={account} onReject={() => setEditingBank(true)} />
        ) : (
          <DoneStep account={account} onChangeBank={() => setEditingBank(true)} />
        )}
      </div>
    </div>
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
                done ? "bg-slate-900" : active ? "bg-slate-400" : "bg-slate-200"
              }`}
            />
            <span
              className={`mt-1.5 block text-[0.7rem] ${
                active ? "font-medium text-slate-900" : done ? "text-slate-500" : "text-slate-400"
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
  account,
  banks,
  onCancel,
}: {
  account: VenuePayoutAccount;
  banks: Bank[] | null;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(submitVenueBankDetailsAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={account.venueId} />

      <p className="text-sm leading-relaxed text-slate-500">
        Where {account.venueName}&rsquo;s share of tips is paid. Changing this later clears
        the checks below, so the account can&rsquo;t be swapped after it&rsquo;s approved.
      </p>

      <BankPicker
        banks={banks}
        tone="light"
        defaultBankName={account.bankName}
        defaultBankCode={account.bankCode}
      />

      <div>
        <label htmlFor="accountNumber" className="mb-1.5 block text-sm font-medium text-slate-700">
          Account number
        </label>
        <input
          id="accountNumber"
          name="accountNumber"
          required
          inputMode="numeric"
          maxLength={10}
          placeholder="0123456789"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">10 digits.</p>
      </div>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex gap-2">
        <Submit label="Save and continue" pendingLabel="Saving…" disabled={banks === null} />
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ResolveStep({
  account,
  onChangeBank,
}: {
  account: VenuePayoutAccount;
  onChangeBank: () => void;
}) {
  const [state, formAction] = useActionState(resolveVenueAccountAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={account.venueId} />
      <Summary account={account} />
      <p className="text-sm leading-relaxed text-slate-500">
        We&rsquo;ll ask the bank whose account this is, then show you the name it returns so
        you can check it.
      </p>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex gap-2">
        <Submit label="Check with the bank" pendingLabel="Checking…" />
        <button
          type="button"
          onClick={onChangeBank}
          className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Change
        </button>
      </div>
    </form>
  );
}

/**
 * Show the bank's own answer back and require an explicit yes. This is the step
 * that makes a payout destination trusted rather than merely typed, so it is
 * never auto-accepted.
 */
function ConfirmStep({
  account,
  onReject,
}: {
  account: VenuePayoutAccount;
  onReject: () => void;
}) {
  const [state, formAction] = useActionState(confirmVenueAccountAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={account.venueId} />
      <input
        type="hidden"
        name="confirmedAccountName"
        value={account.resolvedAccountName ?? ""}
      />

      <p className="text-sm text-slate-500">The bank says this account belongs to:</p>
      <p className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-4 text-center text-lg font-semibold text-slate-900">
        {account.resolvedAccountName ?? "—"}
      </p>
      <Summary account={account} />
      <p className="text-sm leading-relaxed text-slate-500">
        Is that {account.venueName}? Your share of every tip will be paid here.
      </p>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex gap-2">
        <Submit label="Yes, that's us" pendingLabel="Confirming…" />
        <button
          type="button"
          onClick={onReject}
          className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          No, change it
        </button>
      </div>
    </form>
  );
}

function DoneStep({
  account,
  onChangeBank,
}: {
  account: VenuePayoutAccount;
  onChangeBank: () => void;
}) {
  return (
    <div className="space-y-4">
      <Summary account={account} showName />
      <p className="text-sm leading-relaxed text-slate-500">
        {account.payoutsEnabled
          ? "Your share of tips is paid to this account."
          : "This account is confirmed. Payouts switch on once it's fully cleared."}
      </p>
      <button
        type="button"
        onClick={onChangeBank}
        className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Change account
      </button>
    </div>
  );
}

function Summary({
  account,
  showName = false,
}: {
  account: VenuePayoutAccount;
  showName?: boolean;
}) {
  const rows: [string, string][] = [
    ["Bank", account.bankName ?? "—"],
    ["Account", account.accountNumberMasked ?? "—"],
    ...(showName && account.resolvedAccountName
      ? ([["Name", account.resolvedAccountName]] as [string, string][])
      : []),
  ];
  return (
    <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

function Submit({
  label,
  pendingLabel,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
