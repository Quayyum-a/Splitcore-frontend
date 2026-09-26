"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatNaira } from "@/lib/money";
import type { PaymentStatus, PaymentStatusResponse } from "@/lib/api/types";

/**
 * What the guest sees after Paystack sends them back.
 *
 * POLLING: there is no push channel to the browser, so this polls
 * GET /payments/{reference}/status — which re-verifies CREATED/PENDING against
 * Paystack server-side, so it is a real answer rather than a guess made from
 * the redirect's query string.
 *
 *   every 2s for the first 20s   — covers the overwhelming majority
 *   every 4s after that          — keeps load light while a slow webhook lands
 *   stop polling at 150s         — offer a manual re-check instead
 *
 * A timeout is deliberately NOT rendered as failure. The money may well have
 * moved; telling a guest it failed when it didn't is the worst outcome here.
 */
const FAST_INTERVAL_MS = 2_000;
const SLOW_INTERVAL_MS = 4_000;
const FAST_PHASE_MS = 20_000;
const GIVE_UP_MS = 150_000;

const PENDING_STATUSES: PaymentStatus[] = ["CREATED", "PENDING"];

type ViewState =
  | { phase: "loading" }
  | { phase: "polling"; payment: PaymentStatusResponse; timedOut: boolean }
  | { phase: "settled"; payment: PaymentStatusResponse }
  | { phase: "missing" }
  | { phase: "error"; message: string };

export function PaymentStatusView({
  reference,
  retryHref,
}: {
  reference: string | null;
  retryHref: string | null;
}) {
  const [state, setState] = useState<ViewState>(
    reference ? { phase: "loading" } : { phase: "missing" },
  );
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const poll = useCallback(
    async (isManual = false) => {
      if (!reference) return;
      if (isManual) {
        setRechecking(true);
        startedAt.current = Date.now();
      }

      try {
        const response = await fetch(
          `/api/payments/${encodeURIComponent(reference)}/status`,
          { cache: "no-store" },
        );

        if (response.status === 404) {
          setState({ phase: "missing" });
          return;
        }
        if (!response.ok) throw new Error(`status ${response.status}`);

        const payment = (await response.json()) as PaymentStatusResponse;

        if (!PENDING_STATUSES.includes(payment.status)) {
          setState({ phase: "settled", payment });
          return;
        }

        const elapsed = Date.now() - startedAt.current;
        const timedOut = elapsed >= GIVE_UP_MS;
        setState({ phase: "polling", payment, timedOut });

        if (!timedOut) {
          timer.current = setTimeout(
            () => void poll(),
            elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS,
          );
        }
      } catch {
        // A blip on club wifi must not wipe out a result already on screen.
        setState((current) =>
          current.phase === "loading"
            ? { phase: "error", message: "We couldn't check your payment. Check your connection." }
            : current,
        );
        if (Date.now() - startedAt.current < GIVE_UP_MS) {
          timer.current = setTimeout(() => void poll(), SLOW_INTERVAL_MS);
        }
      } finally {
        if (isManual) setRechecking(false);
      }
    },
    [reference],
  );

  useEffect(() => {
    if (!reference) return;
    void poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reference, poll]);

  if (state.phase === "missing") {
    return (
      <Centered>
        <StatusIcon tone="neutral" glyph="question" />
        <h1 className="text-xl font-semibold text-cream">We couldn&rsquo;t find this payment</h1>
        <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-ink-400">
          If money left your account it will still reach the entertainer. Show this screen to
          a member of staff if you need help.
        </p>
        {retryHref ? <SecondaryLink href={retryHref}>Back to tipping</SecondaryLink> : null}
      </Centered>
    );
  }

  if (state.phase === "error") {
    return (
      <Centered>
        <StatusIcon tone="warning" glyph="alert" />
        <h1 className="text-xl font-semibold text-cream">{state.message}</h1>
        <button
          type="button"
          onClick={() => void poll(true)}
          className="mt-8 h-[3.5rem] w-full rounded-2xl bg-gold text-base font-semibold text-ink-950"
        >
          Try again
        </button>
      </Centered>
    );
  }

  if (state.phase === "loading" || state.phase === "polling") {
    const timedOut = state.phase === "polling" && state.timedOut;
    return (
      <Centered>
        <PulseDot />
        <h1 className="mt-6 text-xl font-semibold text-cream">Confirming your payment…</h1>
        <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-ink-400">
          {timedOut
            ? "This is taking longer than usual. Your payment may still go through, so don't pay again."
            : "Hold on while we check with your bank. Don't close this screen."}
        </p>
        {state.phase === "polling" ? (
          <>
            <Amount kobo={state.payment.amountKobo} muted />
            <Reference value={state.payment.reference} />
          </>
        ) : null}
        {timedOut ? (
          <button
            type="button"
            onClick={() => void poll(true)}
            disabled={rechecking}
            className="mt-8 h-[3.5rem] w-full rounded-2xl border border-ink-700 text-base font-medium text-cream disabled:opacity-60"
          >
            {rechecking ? "Checking…" : "Check again"}
          </button>
        ) : null}
      </Centered>
    );
  }

  return <Settled payment={state.payment} retryHref={retryHref} />;
}

/**
 * Each terminal status gets its own screen. SUCCESS and FAILED use the copy
 * fixed by the spec verbatim. REVERSED and REFUNDED are never folded into
 * "unsuccessful" — to a guest those mean different things.
 */
function Settled({
  payment,
  retryHref,
}: {
  payment: PaymentStatusResponse;
  retryHref: string | null;
}) {
  const recipient = payment.entertainerName ?? payment.venueName;

  if (payment.status === "SUCCESS") {
    return (
      <Centered>
        <StatusIcon tone="success" glyph="check" />
        <h1 className="text-2xl font-semibold text-cream">Payment successful</h1>
        <Amount kobo={payment.amountKobo} />
        <p className="mt-1.5 text-base text-ink-300">You tipped {recipient}.</p>
        <Reference value={payment.reference} />
        <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
          <span aria-hidden="true">✓</span> Payment confirmed
        </p>
      </Centered>
    );
  }

  if (payment.status === "REFUNDED" || payment.status === "REVERSED") {
    const refunded = payment.status === "REFUNDED";
    return (
      <Centered>
        <StatusIcon tone="neutral" glyph="undo" />
        <h1 className="text-2xl font-semibold text-cream">
          {refunded ? "Payment refunded" : "Payment reversed"}
        </h1>
        <Amount kobo={payment.amountKobo} muted />
        <p className="mt-1.5 max-w-[19rem] text-sm leading-relaxed text-ink-400">
          {refunded
            ? `This tip to ${recipient} was refunded. The money is on its way back to you.`
            : `This tip to ${recipient} was reversed and will be returned to you.`}
        </p>
        <Reference value={payment.reference} />
        {retryHref ? <SecondaryLink href={retryHref}>Back to tipping</SecondaryLink> : null}
      </Centered>
    );
  }

  // FAILED and ABANDONED. Copy fixed by the spec.
  return (
    <Centered>
      <StatusIcon tone="danger" glyph="cross" />
      <h1 className="text-2xl font-semibold text-cream">Payment unsuccessful</h1>
      <p className="mt-4 text-base text-ink-300">Your payment wasn&rsquo;t completed.</p>
      <Reference value={payment.reference} />
      {retryHref ? (
        <a
          href={retryHref}
          className="mt-8 flex h-[3.75rem] w-full items-center justify-center rounded-2xl bg-gold text-lg font-semibold text-ink-950"
        >
          Try Again
        </a>
      ) : null}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-full flex-col items-center justify-center pb-6 text-center">
      {children}
    </section>
  );
}

function Amount({ kobo, muted = false }: { kobo: number; muted?: boolean }) {
  return (
    <p
      className={`tabular mt-6 text-[2.6rem] leading-none font-bold ${
        muted ? "text-ink-300" : "text-gold-bright"
      }`}
    >
      {formatNaira(kobo)}
    </p>
  );
}

function Reference({ value }: { value: string }) {
  return (
    <div className="mt-7">
      <p className="text-xs text-ink-600">Reference</p>
      <p className="tabular mt-1.5 text-sm break-all text-ink-300">{value}</p>
    </div>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="mt-8 flex h-[3.5rem] w-full items-center justify-center rounded-2xl border border-ink-700 text-base font-medium text-cream"
    >
      {children}
    </a>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-12 w-12 items-center justify-center">
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-gold/50"
        style={{ animation: "sc-pulse-ring 1.6s ease-out infinite" }}
      />
      <span className="h-2.5 w-2.5 rounded-full bg-gold" />
    </span>
  );
}

function StatusIcon({
  tone,
  glyph,
}: {
  tone: "success" | "danger" | "neutral" | "warning";
  glyph: "check" | "cross" | "undo" | "question" | "alert";
}) {
  const tones = {
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-danger/30 bg-danger/10 text-danger",
    neutral: "border-ink-700 bg-ink-850 text-ink-300",
    warning: "border-gold/30 bg-gold/10 text-gold",
  } as const;

  const paths = {
    check: <path d="m7 12.5 3.2 3.2L17 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    cross: <path d="m8.5 8.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
    undo: <path d="M9 7 5.5 10.5 9 14M5.5 10.5H14a4.5 4.5 0 0 1 0 9h-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    question: <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.6M12 17.3h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />,
    alert: <path d="M12 7.5v5.5M12 16.4h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />,
  } as const;

  return (
    <span
      aria-hidden="true"
      className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border ${tones[tone]}`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">{paths[glyph]}</svg>
    </span>
  );
}
