"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Venue } from "@/lib/api/types";

import { createSplitRuleAction, type SplitRuleFormState } from "./actions";

const INITIAL: SplitRuleFormState = { error: null, success: null };

/**
 * Percentages in the UI, basis points on the wire. The backend stores bps
 * (10000 = 100%) and nobody wants to type "7000" to mean 70%.
 */
export function SplitRuleForm({
  venues,
  selectedVenueId,
  initial,
}: {
  venues: Venue[];
  selectedVenueId: string;
  initial: { entertainerBps: number; venueBps: number; platformBps: number };
}) {
  const [state, formAction] = useActionState(createSplitRuleAction, INITIAL);
  const [entertainer, setEntertainer] = useState(initial.entertainerBps / 100);
  const [venue, setVenue] = useState(initial.venueBps / 100);
  const [platform, setPlatform] = useState(initial.platformBps / 100);

  const total = entertainer + venue + platform;
  const balanced = Math.abs(total - 100) < 0.005;

  return (
    <form action={formAction} className="px-5 py-5">
      <input type="hidden" name="venueId" value={selectedVenueId} />
      <input type="hidden" name="entertainerBps" value={Math.round(entertainer * 100)} />
      <input type="hidden" name="venueBps" value={Math.round(venue * 100)} />
      <input type="hidden" name="platformBps" value={Math.round(platform * 100)} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Share label="Entertainer" value={entertainer} onChange={setEntertainer} />
        <Share label="Venue" value={venue} onChange={setVenue} />
        <Share label="Platform" value={platform} onChange={setPlatform} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full">
            <span style={{ width: `${Math.min(entertainer, 100)}%` }} className="bg-slate-900" />
            <span style={{ width: `${Math.min(venue, 100)}%` }} className="bg-slate-500" />
            <span style={{ width: `${Math.min(platform, 100)}%` }} className="bg-amber-400" />
          </div>
        </div>
        <span
          className={`text-sm font-medium tabular-nums ${balanced ? "text-slate-600" : "text-red-600"}`}
        >
          {total.toFixed(2)}%
        </span>
      </div>

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

      <p className="mt-4 text-xs text-slate-500">
        Saving creates a <strong className="font-semibold text-slate-700">new rule</strong> and
        closes out the current one. Rules are an append-only history — nothing is overwritten,
        and tips already taken keep the rule that was active at the time.
      </p>

      <div className="mt-4">
        <Submit disabled={!balanced || venues.length === 0} />
      </div>
    </form>
  );
}

function Share({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const id = `share-${label.toLowerCase()}`;
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

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save new split rule"}
    </button>
  );
}
