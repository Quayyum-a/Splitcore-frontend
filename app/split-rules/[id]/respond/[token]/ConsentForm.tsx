"use client";

import { useState, useTransition } from "react";

import type { SplitRuleTerms } from "@/lib/api/types";

import { respondAction } from "./actions";

type Outcome = "ACCEPT" | "REJECT";

export function ConsentForm({
  splitRuleId,
  token,
  terms,
}: {
  splitRuleId: string;
  token: string;
  terms: SplitRuleTerms;
}) {
  const [settled, setSettled] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(decision: Outcome) {
    setError(null);
    startTransition(async () => {
      const result = await respondAction(splitRuleId, token, decision);
      if (result.kind === "ok") return setSettled(decision);
      if (result.kind === "already-answered") {
        return setError("This proposal has already been answered.");
      }
      if (result.kind === "invalid") {
        return setError("This approval link is no longer valid.");
      }
      setError(result.message);
      setConfirming(null);
    });
  }

  if (settled) {
    const accepted = settled === "ACCEPT";
    return (
      <section className="flex h-full flex-col items-center justify-center text-center">
        <span
          aria-hidden="true"
          className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border ${
            accepted
              ? "border-success/30 bg-success/10 text-success"
              : "border-ink-700 bg-ink-850 text-ink-300"
          }`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            {accepted ? (
              <path d="m7 12.5 3.2 3.2L17 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="m8.5 8.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
        </span>
        <h1 className="text-2xl font-semibold text-cream">
          {accepted ? "Terms accepted" : "Terms declined"}
        </h1>
        <p className="mt-3 max-w-[20rem] text-sm leading-relaxed text-ink-400">
          {accepted
            ? `You'll receive ${terms.entertainerPercentage}% of every tip at ${terms.venueName} from now on. This split is now in force.`
            : `Nothing has changed. ${terms.venueName} can propose different terms and send you a new link.`}
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-[1.7rem] leading-tight font-bold text-cream">
          {terms.venueName} is proposing your split
        </h1>
        <p className="mt-2.5 text-sm text-ink-400">for {terms.entertainerName}</p>
      </div>

      <section className="mt-7 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="px-5 pt-6 pb-5 text-center">
          <p className="tabular text-[3rem] leading-none font-bold text-gold-bright">
            {terms.entertainerPercentage}%
          </p>
          <p className="mt-2 text-base text-ink-300">of every tip goes to you</p>
        </div>

        <div className="flex h-2 border-t border-ink-800">
          <span style={{ width: `${terms.entertainerPercentage}%` }} className="bg-gold" />
          <span style={{ width: `${terms.venuePercentage}%` }} className="bg-ink-600" />
          <span style={{ width: `${terms.platformPercentage}%` }} className="bg-ink-700" />
        </div>

        <dl className="divide-y divide-ink-800 text-sm">
          <Row label="You" value={`${terms.entertainerPercentage}%`} emphasis />
          <Row label={terms.venueName} value={`${terms.venuePercentage}%`} />
          <Row label="Splitcore fee" value={`${terms.platformPercentage}%`} />
        </dl>
      </section>

      {/* The backend writes this sentence; it turns percentages into money. */}
      <p className="mt-4 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-center text-sm leading-relaxed text-ink-300">
        {terms.example}
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-8 space-y-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {confirming === "REJECT" ? (
          <ConfirmRow
            question="Decline these terms?"
            confirmLabel="Yes, decline"
            pending={pending}
            onConfirm={() => respond("REJECT")}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => respond("ACCEPT")}
              disabled={pending}
              className="h-[3.75rem] w-full rounded-2xl bg-gold text-lg font-semibold text-ink-950 disabled:bg-ink-800 disabled:text-ink-600"
            >
              {pending ? "Saving…" : "Accept"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming("REJECT")}
              disabled={pending}
              className="h-[3.25rem] w-full rounded-2xl border border-ink-700 text-base font-medium text-ink-300 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        <p className="pt-2 text-center text-xs leading-relaxed text-ink-600">
          Your answer is final. Nothing is split until you accept.
        </p>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className={emphasis ? "font-medium text-cream" : "text-ink-400"}>{label}</dt>
      <dd className={`tabular text-right font-medium ${emphasis ? "text-gold" : "text-ink-300"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Rejection is irreversible and spends the token, so it gets a second tap. */
function ConfirmRow({
  question,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <p className="mb-3 text-center text-sm text-cream">{question}</p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-[3.25rem] flex-1 rounded-xl border border-ink-700 text-base font-medium text-ink-300"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-[3.25rem] flex-1 rounded-xl bg-danger/90 text-base font-semibold text-ink-950 disabled:opacity-60"
        >
          {pending ? "Saving…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
