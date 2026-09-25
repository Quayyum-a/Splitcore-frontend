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

export function TipForm({
  token,
  resolution,
}: {
  token: string;
  resolution: QrResolution;
}) {
  const { venue, entertainer, location } = resolution;
  const recipient = entertainer?.stageName ?? venue.name;

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

  const hasAmount = amountKobo !== null && validateTipKobo(amountKobo) === null;
  const nameOk = identity !== "named" || displayName.trim().length > 0;
  const canContinue = hasAmount && identity !== null && nameOk && !pending;

  function choosePreset(kobo: number) {
    setSelectedPreset(kobo);
    setCustomOpen(false);
    setCustomValue("");
    setError(null);
  }

  function openCustom() {
    setCustomOpen(true);
    setSelectedPreset(null);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const amountError = validateTipKobo(amountKobo);
    if (amountError) {
      setError(amountError);
      return;
    }
    if (identity === null) {
      setError("Choose whether to tip anonymously or show your name.");
      return;
    }
    if (identity === "named" && displayName.trim().length === 0) {
      setError("Enter the name you'd like shown.");
      return;
    }

    startTransition(async () => {
      const result = await startPayment({
        token,
        amountKobo: amountKobo as number,
        displayNameEnabled: identity === "named",
        guestDisplayName: identity === "named" ? displayName : undefined,
      });

      if (result.ok) {
        // Full navigation, not router.push — Paystack checkout is off-origin.
        window.location.assign(result.authorizationUrl);
        return;
      }
      if (result.retryable) setError(result.error);
      else setFatal(result.error);
    });
  }

  if (fatal) {
    return (
      <section className="sc-rise flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-ink-100">{fatal}</p>
        <p className="mt-3 text-sm text-ink-400">
          Ask a member of staff for an up-to-date code.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="sc-rise flex flex-1 flex-col">
      <div className="text-center">
        <h1 className="text-[2rem] leading-tight font-bold uppercase tracking-[0.04em] text-ink-100">
          {recipient}
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          {venue.name}
          {location ? <span className="text-ink-600"> · {location}</span> : null}
        </p>
        <p className="mt-6 text-lg text-ink-300">Show some love ❤️</p>
      </div>

      <fieldset className="mt-7">
        <legend className="sr-only">Choose an amount</legend>
        <div className="grid grid-cols-2 gap-3">
          {PRESET_TIPS_KOBO.map((kobo) => {
            const active = !customOpen && selectedPreset === kobo;
            return (
              <button
                key={kobo}
                type="button"
                onClick={() => choosePreset(kobo)}
                aria-pressed={active}
                className={`h-[4.25rem] rounded-2xl border text-xl font-semibold transition-colors ${
                  active
                    ? "border-gold-500 bg-gold-500 text-ink-950"
                    : "border-ink-700 bg-ink-850 text-ink-100 active:bg-ink-800"
                }`}
              >
                {formatNaira(kobo)}
              </button>
            );
          })}
        </div>

        {customOpen ? (
          <div className="mt-3">
            <label
              htmlFor="custom-amount"
              className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink-400"
            >
              Custom amount
            </label>
            <div className="flex items-center rounded-2xl border border-gold-500 bg-ink-850 px-4 focus-within:ring-2 focus-within:ring-gold-500/40">
              <span className="text-xl font-semibold text-ink-400">₦</span>
              <input
                ref={customInputRef}
                id="custom-amount"
                name="customAmount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={customValue}
                onChange={(event) => {
                  setCustomValue(event.target.value);
                  setError(null);
                }}
                className="h-[4rem] w-full bg-transparent px-2 text-xl font-semibold text-ink-100 outline-none placeholder:text-ink-600"
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">
              {formatNaira(MIN_TIP_KOBO)} – {formatNaira(MAX_TIP_KOBO)}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCustom}
            className="mt-3 h-[3.5rem] w-full rounded-2xl border border-dashed border-ink-600 text-base font-medium text-ink-300 active:bg-ink-850"
          >
            Custom Amount
          </button>
        )}
      </fieldset>

      <fieldset className="mt-7">
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-ink-400">
          How should this show up?
        </legend>
        <div className="space-y-2.5">
          <IdentityOption
            checked={identity === "anonymous"}
            onSelect={() => {
              setIdentity("anonymous");
              setError(null);
            }}
            label="Anonymous"
          />
          <IdentityOption
            checked={identity === "named"}
            onSelect={() => {
              setIdentity("named");
              setError(null);
            }}
            label="Show my name"
          />
        </div>

        {identity === "named" ? (
          <div className="mt-3">
            <label htmlFor="display-name" className="sr-only">
              Your name
            </label>
            <input
              ref={nameInputRef}
              id="display-name"
              name="displayName"
              type="text"
              autoComplete="given-name"
              maxLength={40}
              placeholder="Your name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError(null);
              }}
              className="h-[3.5rem] w-full rounded-2xl border border-ink-700 bg-ink-850 px-4 text-base text-ink-100 outline-none placeholder:text-ink-600 focus:border-gold-500"
            />
          </div>
        ) : null}
      </fieldset>

      <div className="mt-auto pt-8">
        {error ? (
          <p role="alert" className="mb-3 text-center text-sm text-danger-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canContinue}
          className="h-[3.75rem] w-full rounded-2xl bg-gold-500 text-lg font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-600"
        >
          {pending ? "Starting…" : "Continue"}
        </button>

        <p className="mt-4 text-center text-xs text-ink-600">
          Secured by Paystack. You&rsquo;ll be taken to a secure checkout page.
        </p>
      </div>
    </form>
  );
}

/**
 * A radio in behaviour and semantics, but the whole row is the tap target —
 * a 12px circle is not something to aim at one-handed in a dark club.
 */
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
        checked ? "border-gold-500 bg-gold-500/10" : "border-ink-700 bg-ink-850"
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
          checked ? "border-gold-500" : "border-ink-600"
        }`}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-gold-500" /> : null}
      </span>
      <span className={`text-base ${checked ? "text-ink-100" : "text-ink-300"}`}>
        {label}
      </span>
    </label>
  );
}
