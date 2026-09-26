"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createSplitRuleAction, type SplitRuleFormState } from "./actions";

const INITIAL: SplitRuleFormState = { error: null, success: null };
const TOTAL_BPS = 10_000;

/**
 * Percentages in the UI, basis points on the wire.
 *
 * The platform share is locked for venue admins: it is Splitcore's fee, not a
 * venue's to set. Today the live API still accepts it from the client, so it is
 * submitted as a hidden field carried forward from the venue's active rule —
 * when the backend starts computing it server-side, that hidden input is all
 * that needs removing.
 *
 * Venue and entertainer are a linked pair. Moving one moves the other so the
 * three always total 100%: an invalid split is not a state worth letting
 * someone type their way into and then be told off about.
 */
export function SplitRuleForm({
  selectedVenueId,
  initial,
  canEditPlatformFee,
}: {
  selectedVenueId: string;
  initial: { entertainerBps: number; venueBps: number; platformBps: number };
  canEditPlatformFee: boolean;
}) {
  const [state, formAction] = useActionState(createSplitRuleAction, INITIAL);
  const [platformBps, setPlatformBps] = useState(initial.platformBps);
  const [entertainerBps, setEntertainerBps] = useState(initial.entertainerBps);

  const availableBps = TOTAL_BPS - platformBps;
  const venueBps = Math.max(0, availableBps - entertainerBps);
  const pct = (bps: number) => bps / 100;

  function setPlatform(nextPct: number) {
    const next = Math.round(Math.min(100, Math.max(0, nextPct)) * 100);
    setPlatformBps(next);
    // Keep the entertainer's share inside whatever is left.
    setEntertainerBps((current) => Math.min(current, TOTAL_BPS - next));
  }

  return (
    <form action={formAction} className="px-5 py-5">
      <input type="hidden" name="venueId" value={selectedVenueId} />
      <input type="hidden" name="entertainerBps" value={entertainerBps} />
      <input type="hidden" name="venueBps" value={venueBps} />
      <input type="hidden" name="platformBps" value={platformBps} />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden="true">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8.5 10.5V7.8a3.5 3.5 0 1 1 7 0v2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Platform fee</span>
          </div>

          {canEditPlatformFee ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                aria-label="Platform fee percentage"
                value={pct(platformBps)}
                onChange={(event) => setPlatform(Number(event.target.value))}
                className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2.5 text-right text-sm tabular-nums text-slate-900"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {pct(platformBps)}%
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {canEditPlatformFee
            ? "You can change this because you're a platform admin. Venue admins see it locked."
            : "Set by Splitcore. Venue and entertainer shares divide what's left."}
        </p>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="entertainer-share" className="text-sm font-medium text-slate-700">
            Entertainer
          </label>
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {pct(entertainerBps)}%
          </span>
        </div>
        <input
          id="entertainer-share"
          type="range"
          min={0}
          max={availableBps}
          step={50}
          value={Math.min(entertainerBps, availableBps)}
          onChange={(event) => setEntertainerBps(Number(event.target.value))}
          className="w-full accent-slate-900"
        />
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700">Venue</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {pct(venueBps)}%
          </span>
        </div>
      </div>

      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <span style={{ width: `${pct(entertainerBps)}%` }} className="bg-slate-900" title="Entertainer" />
        <span style={{ width: `${pct(venueBps)}%` }} className="bg-slate-400" title="Venue" />
        <span style={{ width: `${pct(platformBps)}%` }} className="bg-amber-400" title="Platform" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        On a ₦5,000 tip: entertainer {formatShare(entertainerBps)}, venue {formatShare(venueBps)},
        Splitcore {formatShare(platformBps)}.
      </p>

      {state.error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <div className="mt-5">
        <Submit />
      </div>
    </form>
  );
}

/** Concrete naira on a ₦5,000 tip — percentages alone are easy to misjudge. */
function formatShare(bps: number): string {
  const kobo = Math.round((500_000 * bps) / 10_000);
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save new split"}
    </button>
  );
}
