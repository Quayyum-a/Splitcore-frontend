"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  MAX_TIP_KOBO,
  MIN_TIP_KOBO,
  PRESET_TIPS_KOBO,
  formatNaira,
  parseNairaToKobo,
  validateTipKobo,
} from "@/lib/money";
import type { QrResolution } from "@/lib/api/types";

import { startPayment } from "./actions";

type Identity = "anonymous" | "named";
type Step = "amount" | "checkout";

export function TipFlow({
  token,
  resolution,
}: {
  token: string;
  resolution: QrResolution;
}) {
  const { venue, entertainer, location } = resolution;
  const recipient = entertainer?.stageName ?? venue.name;

  const [step, setStep] = useState<Step>("amount");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const customInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  useEffect(() => {
    if (identity === "named") nameInputRef.current?.focus();
  }, [identity]);

  const customKobo = customOpen ? parseNairaToKobo(customValue) : null;
  const amountKobo = customOpen ? customKobo : selectedPreset;
  const amountValid = amountKobo !== null && validateTipKobo(amountKobo) === null;
  const nameOk = identity !== "named" || displayName.trim().length > 0;
  const canContinue = amountValid && identity !== null && nameOk;

  if (fatal) {
    return (
      <section className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-cream">{fatal}</p>
        <p className="mt-3 text-sm text-ink-400">
          Ask a member of staff for an up-to-date code.
        </p>
      </section>
    );
  }

  function goToCheckout() {
    const amountError = validateTipKobo(amountKobo);
    if (amountError) return setError(amountError);
    if (identity === null) {
      return setError("Choose whether to tip anonymously or show your name.");
    }
    if (identity === "named" && displayName.trim().length === 0) {
      return setError("Enter the name you'd like shown.");
    }
    setError(null);
    setStep("checkout");
  }

  function pay() {
    setError(null);
    startTransition(async () => {
      const result = await startPayment({
        token,
        amountKobo: amountKobo as number,
        displayNameEnabled: identity === "named",
        guestDisplayName: identity === "named" ? displayName : undefined,
      });

      if (result.ok) {
        // Full navigation: Paystack checkout is off-origin.
        window.location.assign(result.authorizationUrl);
        return;
      }
      if (result.retryable) setError(result.error);
      else setFatal(result.error);
    });
  }

  if (step === "checkout") {
    return (
      <Checkout
        recipient={recipient}
        venueName={venue.name}
        location={location}
        amountKobo={amountKobo as number}
        shownAs={identity === "named" ? displayName.trim() : null}
        error={error}
        pending={pending}
        onBack={() => {
          setError(null);
          setStep("amount");
        }}
        onPay={pay}
      />
    );
  }

  return (
    <AmountStep
      recipient={recipient}
      venueName={venue.name}
      location={location}
      selectedPreset={selectedPreset}
      customOpen={customOpen}
      customValue={customValue}
      customInputRef={customInputRef}
      nameInputRef={nameInputRef}
      identity={identity}
      displayName={displayName}
      error={error}
      canContinue={canContinue}
      onPreset={(kobo) => {
        setSelectedPreset(kobo);
        setCustomOpen(false);
        setCustomValue("");
        setError(null);
      }}
      onOpenCustom={() => {
        setCustomOpen(true);
        setSelectedPreset(null);
        setError(null);
      }}
      onCustomChange={(value) => {
        setCustomValue(value);
        setError(null);
      }}
      onIdentity={(next) => {
        setIdentity(next);
        setError(null);
      }}
      onDisplayName={(value) => {
        setDisplayName(value);
        setError(null);
      }}
      onContinue={goToCheckout}
    />
  );
}

/* ------------------------------------------------------------------ step 1 */

function AmountStep(props: {
  recipient: string;
  venueName: string;
  location: string;
  selectedPreset: number | null;
  customOpen: boolean;
  customValue: string;
  customInputRef: React.RefObject<HTMLInputElement | null>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  identity: Identity | null;
  displayName: string;
  error: string | null;
  canContinue: boolean;
  onPreset: (kobo: number) => void;
  onOpenCustom: () => void;
  onCustomChange: (value: string) => void;
  onIdentity: (identity: Identity) => void;
  onDisplayName: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onContinue();
      }}
      className="flex h-full flex-col"
    >
      <div className="text-center">
        <h1 className="text-[2.1rem] leading-[1.05] font-bold tracking-[0.01em] text-cream uppercase">
          {props.recipient}
        </h1>
        <p className="mt-2.5 text-sm text-ink-400">
          at {props.venueName}
          {props.location ? `, ${props.location}` : ""}
        </p>
        <p className="mt-7 text-lg text-ink-300">Show some love ❤️</p>
      </div>

      <fieldset className="mt-7">
        <legend className="sr-only">Choose an amount</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {PRESET_TIPS_KOBO.map((kobo) => {
            const active = !props.customOpen && props.selectedPreset === kobo;
            return (
              <button
                key={kobo}
                type="button"
                onClick={() => props.onPreset(kobo)}
                aria-pressed={active}
                className={`tabular h-[4.5rem] rounded-2xl border text-[1.35rem] font-semibold transition-colors ${
                  active
                    ? "border-gold bg-gold text-ink-950"
                    : "border-ink-700 bg-ink-850 text-cream active:bg-ink-800"
                }`}
              >
                {formatNaira(kobo)}
              </button>
            );
          })}
        </div>

        {props.customOpen ? (
          <div className="mt-2.5">
            <div className="flex items-center rounded-2xl border border-gold bg-ink-850 px-4">
              <span className="text-[1.35rem] font-semibold text-ink-400">₦</span>
              <input
                ref={props.customInputRef}
                id="custom-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label="Custom amount in naira"
                value={props.customValue}
                onChange={(event) => props.onCustomChange(event.target.value)}
                className="tabular h-[4.25rem] w-full bg-transparent px-2 text-[1.35rem] font-semibold text-cream outline-none placeholder:text-ink-600"
              />
            </div>
            <p className="tabular mt-2 text-center text-xs text-ink-400">
              {formatNaira(MIN_TIP_KOBO)} to {formatNaira(MAX_TIP_KOBO)}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={props.onOpenCustom}
            className="mt-2.5 h-[3.5rem] w-full rounded-2xl border border-dashed border-ink-600 text-base font-medium text-ink-300 active:bg-ink-850"
          >
            Custom Amount
          </button>
        )}
      </fieldset>

      <fieldset className="mt-7">
        <legend className="sr-only">How your tip appears</legend>
        <div className="space-y-2">
          <IdentityOption
            checked={props.identity === "anonymous"}
            onSelect={() => props.onIdentity("anonymous")}
            label="Anonymous"
          />
          <IdentityOption
            checked={props.identity === "named"}
            onSelect={() => props.onIdentity("named")}
            label="Show my name"
          />
        </div>

        {props.identity === "named" ? (
          <input
            ref={props.nameInputRef}
            type="text"
            autoComplete="given-name"
            maxLength={40}
            placeholder="Your name"
            aria-label="Your name"
            value={props.displayName}
            onChange={(event) => props.onDisplayName(event.target.value)}
            className="mt-2 h-[3.5rem] w-full rounded-2xl border border-ink-700 bg-ink-850 px-4 text-base text-cream outline-none placeholder:text-ink-600 focus:border-gold"
          />
        ) : null}
      </fieldset>

      <div className="mt-auto pt-8">
        {props.error ? (
          <p role="alert" className="mb-3 text-center text-sm text-danger">
            {props.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!props.canContinue}
          className="h-[3.75rem] w-full rounded-2xl bg-gold text-lg font-semibold text-ink-950 disabled:bg-ink-800 disabled:text-ink-600"
        >
          Continue
        </button>
      </div>
    </form>
  );
}

function IdentityOption({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label
      className={`flex h-[3.5rem] cursor-pointer items-center gap-3 rounded-2xl border px-4 transition-colors ${
        checked ? "border-gold bg-gold/10" : "border-ink-700 bg-ink-850"
      }`}
    >
      <input
        type="radio"
        name="identity"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-gold" : "border-ink-600"
        }`}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-gold" /> : null}
      </span>
      <span className={`text-base ${checked ? "text-cream" : "text-ink-300"}`}>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ step 2 */

/**
 * One summary card, then one button that states the amount it will charge.
 * No fee breakdown is shown because POST /payments/initialize returns no fee
 * information — inventing a line item would be worse than omitting one.
 */
function Checkout({
  recipient,
  venueName,
  location,
  amountKobo,
  shownAs,
  error,
  pending,
  onBack,
  onPay,
}: {
  recipient: string;
  venueName: string;
  location: string;
  amountKobo: number;
  shownAs: string | null;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onPay: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={pending}
        className="-ml-1 mb-5 inline-flex items-center gap-1.5 py-1 text-sm text-ink-300 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14.5 6 9 12l5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Change amount
      </button>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="px-5 pt-6 pb-5 text-center">
          <p className="tabular text-[2.75rem] leading-none font-bold text-gold-bright">
            {formatNaira(amountKobo)}
          </p>
          <p className="mt-2.5 text-base text-ink-300">
            to <span className="font-medium text-cream">{recipient}</span>
          </p>
        </div>

        <dl className="divide-y divide-ink-800 border-t border-ink-800 text-sm">
          <Row label="Venue" value={venueName} />
          {location ? <Row label="Spot" value={location} /> : null}
          <Row label="Shows as" value={shownAs ?? "Anonymous"} />
        </dl>
      </section>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
        Nothing is added at checkout — you pay exactly this amount. Paystack handles the
        payment on its own secure page.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {error}
        </p>
      ) : null}

      <PayButton amountKobo={amountKobo} pending={pending} onPay={onPay} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right font-medium text-cream">{value}</dd>
    </div>
  );
}

/**
 * Rendered inline rather than through GuestShell's footer slot so the whole
 * checkout stays one component; `sticky` keeps it on screen without taking the
 * button out of the document flow on short viewports.
 */
function PayButton({
  amountKobo,
  pending,
  onPay,
}: {
  amountKobo: number;
  pending: boolean;
  onPay: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-8 bg-ink-950 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onPay}
        disabled={pending}
        className="tabular h-[3.75rem] w-full rounded-2xl bg-gold text-lg font-semibold text-ink-950 disabled:bg-ink-800 disabled:text-ink-600"
      >
        {pending ? "Starting…" : `Pay ${formatNaira(amountKobo)}`}
      </button>
    </div>
  );
}
