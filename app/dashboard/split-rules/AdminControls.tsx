"use client";

import { useActionState, useState } from "react";

import type { PlatformSettings } from "@/lib/api/types";

import { Submit } from "./ProposeSplitForm";
import {
  overrideSplitRuleAction,
  updatePlatformFeeAction,
  type SplitRuleFormState,
} from "./actions";

const INITIAL: SplitRuleFormState = { error: null, success: null };

/** PLATFORM_ADMIN only: change Splitcore's cut for future proposals. */
export function PlatformFeeForm({ settings }: { settings: PlatformSettings }) {
  const [state, formAction] = useActionState(updatePlatformFeeAction, INITIAL);
  const [pct, setPct] = useState(settings.platformFeeBps / 100);

  return (
    <form action={formAction} className="px-5 py-5">
      <input type="hidden" name="platformFeeBps" value={Math.round(pct * 100)} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="platform-fee" className="mb-1.5 block text-sm font-medium text-slate-700">
            Platform fee
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="platform-fee"
              type="number"
              min={0}
              max={90}
              step={0.01}
              value={pct}
              onChange={(event) => setPct(Number(event.target.value))}
              className="h-10 w-28 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm tabular-nums text-slate-900"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>
        <Submit label="Save fee" pendingLabel="Saving…" />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Applies to splits proposed from now on. Splits already in force keep the fee they
        were agreed under — nobody&rsquo;s agreed terms are rewritten underneath them.
      </p>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

/**
 * PLATFORM_ADMIN only: force a split without the entertainer agreeing.
 *
 * Kept collapsed behind a deliberate click. This is the exception — for dispute
 * resolution — and the whole governance model exists to make it rare, so it
 * should not sit open next to the normal path inviting use.
 */
export function OverrideForm({
  venueId,
  venueName,
  initial,
}: {
  venueId: string;
  venueName: string;
  initial: { entertainerBps: number; venueBps: number; platformBps: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(overrideSplitRuleAction, INITIAL);

  const [entertainerPct, setEntertainerPct] = useState(initial.entertainerBps / 100);
  const [venuePct, setVenuePct] = useState(initial.venueBps / 100);
  const [platformPct, setPlatformPct] = useState(initial.platformBps / 100);

  const total = entertainerPct + venuePct + platformPct;
  const balanced = Math.abs(total - 100) < 0.005;

  if (!open) {
    return (
      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          Force a split without approval
        </button>
        <p className="mt-1 text-xs text-slate-500">
          For dispute resolution. Recorded permanently as an override.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="px-5 py-5">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="entertainerBps" value={Math.round(entertainerPct * 100)} />
      <input type="hidden" name="venueBps" value={Math.round(venuePct * 100)} />
      <input type="hidden" name="platformBps" value={Math.round(platformPct * 100)} />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">
          This takes effect immediately for {venueName}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          No entertainer agrees to it. The split is stamped{" "}
          <code className="font-mono text-xs">ADMIN_OVERRIDE</code> and your reason goes into
          an append-only audit trail, so it can never be mistaken for agreed terms.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Pct label="Entertainer" value={entertainerPct} onChange={setEntertainerPct} />
        <Pct label="Venue" value={venuePct} onChange={setVenuePct} />
        <Pct label="Platform" value={platformPct} onChange={setPlatformPct} />
      </div>

      <p className={`mt-2 text-sm tabular-nums ${balanced ? "text-slate-500" : "text-red-600"}`}>
        Total {total.toFixed(2)}%
      </p>

      <div className="mt-4">
        <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-slate-700">
          Why is this being forced?
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          rows={2}
          placeholder="Dispute resolution ticket SC-1042; agreed by phone with both parties."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Submit
          label="Force this split"
          pendingLabel="Applying…"
          disabled={!balanced}
          tone="danger"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Pct({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const id = `override-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3">
        <input
          id={id}
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-10 w-full bg-transparent text-sm tabular-nums text-slate-900 outline-none"
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}
