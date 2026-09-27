"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { issueLoginLinkAction, type LoginLinkState } from "./actions";

const INITIAL: LoginLinkState = { error: null, loginUrl: null };

/**
 * Hands a venue a one-time sign-in link to pass to an entertainer.
 *
 * Shown inline and never dismissed automatically: the link is single use, the
 * previous one dies the moment this is pressed again, and there is no other
 * channel to deliver it. Losing this panel means the entertainer can't get in.
 */
export function LoginLinkButton({
  entertainerId,
  stageName,
}: {
  entertainerId: string;
  stageName: string;
}) {
  const [state, formAction] = useActionState(issueLoginLinkAction, INITIAL);
  const [copied, setCopied] = useState(false);

  if (state.loginUrl) {
    return (
      <div className="min-w-[15rem]">
        <p className="text-xs font-medium text-emerald-800">
          Send this to {state.stageName || stageName}
        </p>
        <div className="mt-1.5 flex gap-1.5">
          <input
            readOnly
            value={state.loginUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 w-full rounded-md border border-slate-300 bg-slate-50 px-2 font-mono text-[0.68rem] text-slate-700"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.loginUrl!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
            className="h-8 shrink-0 rounded-md bg-slate-900 px-2.5 text-xs font-semibold text-white"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-1 text-[0.68rem] text-slate-500">
          Works once. Expires {formatExpiry(state.expiresAt)}.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="entertainerId" value={entertainerId} />
      <input type="hidden" name="stageName" value={stageName} />
      <Submit />
      {state.error ? (
        <p role="alert" className="mt-1 max-w-[12rem] text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Creating…" : "Sign-in link"}
    </button>
  );
}

function formatExpiry(iso?: string): string {
  if (!iso) return "in 30 minutes";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "in 30 minutes";
  return `at ${new Intl.DateTimeFormat("en-NG", {
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date)}`;
}
