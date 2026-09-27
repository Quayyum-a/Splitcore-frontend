"use client";

import { useState, useTransition } from "react";

import { redeemAction } from "./actions";

export function OpenPortal({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex h-full flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold text-cream">Your Splitcore account</h1>
      <p className="mt-3 max-w-[20rem] text-sm leading-relaxed text-ink-400">
        Tap below to see what you&rsquo;ve earned and finish setting up your payouts. No
        password needed.
      </p>

      {error ? (
        <p role="alert" className="mt-6 max-w-[20rem] text-sm leading-relaxed text-danger">
          {error}
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await redeemAction(token);
              if (result?.error) setError(result.error);
            })
          }
          className="mt-8 h-[3.75rem] w-full rounded-2xl bg-gold text-lg font-semibold text-ink-950 disabled:bg-ink-800 disabled:text-ink-600"
        >
          {pending ? "Opening…" : "Open my dashboard"}
        </button>
      )}

      <p className="mt-6 max-w-[19rem] text-xs leading-relaxed text-ink-600">
        This link works once and expires 30 minutes after your venue created it.
      </p>
    </section>
  );
}
