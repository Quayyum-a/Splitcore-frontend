"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Entertainer, PlatformSettings } from "@/lib/api/types";

import { proposeSplitRuleAction, type SplitRuleFormState } from "./actions";

const INITIAL: SplitRuleFormState = { error: null, success: null };

/**
 * Propose a split for an entertainer to accept.
 *
 * The platform fee is read-only and comes from GET /platform/settings — it is
 * Splitcore's cut, not a venue's to set, and the endpoint rejects a payload
 * containing it. Venue and entertainer divide `splittableBps` between them as a
 * linked pair, so an invalid total can't be typed in the first place.
 */
export function ProposeSplitForm({
  venueId,
  entertainers,
  settings,
  initialEntertainerBps,
}: {
  venueId: string;
  entertainers: Entertainer[];
  settings: PlatformSettings;
  initialEntertainerBps: number;
}) {
  const [state, formAction] = useActionState(proposeSplitRuleAction, INITIAL);
  const { splittableBps, platformFeeBps } = settings;

  const [entertainerId, setEntertainerId] = useState(entertainers[0]?.id ?? "");
  const [entertainerBps, setEntertainerBps] = useState(
    Math.min(initialEntertainerBps, splittableBps),
  );

  const venueBps = Math.max(0, splittableBps - entertainerBps);
  const pct = (bps: number) => bps / 100;
  const entertainerName =
    entertainers.find((e) => e.id === entertainerId)?.stageName ?? "";

  if (state.consentUrl) {
    return <ConsentLinkPanel url={state.consentUrl} name={state.entertainerName ?? ""} />;
  }

  if (entertainers.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        No active entertainer is linked to this venue yet, and a split needs someone to
        agree to it. Add or link one under Entertainers first.
      </p>
    );
  }

  return (
    <form action={formAction} className="px-5 py-5">
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="entertainerBps" value={entertainerBps} />
      <input type="hidden" name="venueBps" value={venueBps} />
      <input type="hidden" name="splittableBps" value={splittableBps} />
      <input type="hidden" name="entertainerName" value={entertainerName} />

      <div className="mb-5">
        <label htmlFor="entertainerId" className="mb-1.5 block text-sm font-medium text-slate-700">
          Who needs to agree?
        </label>
        <select
          id="entertainerId"
          name="entertainerId"
          value={entertainerId}
          onChange={(event) => setEntertainerId(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
        >
          {entertainers.map((entertainer) => (
            <option key={entertainer.id} value={entertainer.id}>
              {entertainer.stageName}
            </option>
          ))}
        </select>
      </div>

      <LockedPlatformFee bps={platformFeeBps} />

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
          max={splittableBps}
          step={50}
          value={entertainerBps}
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

      <SplitBar
        entertainerBps={entertainerBps}
        venueBps={venueBps}
        platformBps={platformFeeBps}
      />

      {state.error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        This creates a proposal, not a live split. It divides no money until{" "}
        {entertainerName || "the entertainer"} accepts it.
      </p>

      <div className="mt-4">
        <Submit label="Send for approval" pendingLabel="Sending…" />
      </div>
    </form>
  );
}

/**
 * The consent link is returned once and never retrievable again — there is no
 * notification channel, so the dashboard is the delivery mechanism. That makes
 * losing this panel a real failure, hence the emphasis and the copy button.
 */
function ConsentLinkPanel({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="px-5 py-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-900">
          Proposal sent{name ? ` to ${name}` : ""}
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          It divides no money until they accept. Send them this link — it is shown once
          and can&rsquo;t be retrieved later.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-700"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked; the field is selectable either way.
              setCopied(false);
            }
          }}
          className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Entertainers sign nothing and create no account — the link is the agreement.
      </p>
    </div>
  );
}

export function LockedPlatformFee({ bps }: { bps: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8.5 10.5V7.8a3.5 3.5 0 1 1 7 0v2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Platform fee
        </span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {bps / 100}%
        </span>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Set by Splitcore. Venue and entertainer divide the remaining {(10000 - bps) / 100}%.
      </p>
    </div>
  );
}

export function SplitBar({
  entertainerBps,
  venueBps,
  platformBps,
}: {
  entertainerBps: number;
  venueBps: number;
  platformBps: number;
}) {
  const share = (bps: number) => `₦${Math.round((5000 * bps) / 10000).toLocaleString("en-NG")}`;
  return (
    <>
      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        <span style={{ width: `${entertainerBps / 100}%` }} className="bg-slate-900" />
        <span style={{ width: `${venueBps / 100}%` }} className="bg-slate-400" />
        <span style={{ width: `${platformBps / 100}%` }} className="bg-amber-400" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        On a ₦5,000 tip: entertainer {share(entertainerBps)}, venue {share(venueBps)},
        Splitcore {share(platformBps)}.
      </p>
    </>
  );
}

export function Submit({
  label,
  pendingLabel,
  disabled = false,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${
        tone === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-slate-900 hover:bg-slate-800"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
