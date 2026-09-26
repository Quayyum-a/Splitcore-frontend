import type { Metadata } from "next";

import { resolveToken } from "@/lib/api/guest";

import { GuestShell } from "./GuestShell";
import { TipForm } from "./TipForm";

/**
 * The page a scanned QR code actually lands on.
 *
 * This route is the whole reason this frontend exists. The backend's
 * GET /t/{token} returns JSON (docs/api-audit.md §3.2) — pointing a QR code at
 * it shows a guest raw JSON. QR codes encode THIS url instead, and this page
 * turns the token into a human tipping screen.
 *
 * force-dynamic: a token's validity changes the moment a venue deactivates a
 * QR code. A cached "still valid" render would take tips for a dead code.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Send a tip" };

export default async function TipPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveToken(token);

  if (resolution.kind === "not-found") {
    return (
      <GuestShell>
        <GuestMessage
          title="This tipping link isn't valid."
          detail="Double-check the code you scanned, or ask a member of staff."
        />
      </GuestShell>
    );
  }

  if (resolution.kind === "gone") {
    return (
      <GuestShell>
        <GuestMessage
          title="This tipping link is no longer active."
          detail="This code has been turned off. Ask a member of staff for a current one."
        />
      </GuestShell>
    );
  }

  if (resolution.kind === "error") {
    return (
      <GuestShell>
        <GuestMessage
          title="We couldn't load this tipping page."
          detail="Check your connection and try again in a moment."
          tone="warning"
        />
      </GuestShell>
    );
  }

  return (
    <GuestShell>
      <TipForm token={token} resolution={resolution.data} />
    </GuestShell>
  );
}

function GuestMessage({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <section className="sc-rise flex flex-1 flex-col items-center justify-center text-center">
      <span
        aria-hidden="true"
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border ${
          tone === "warning"
            ? "border-gold-600/40 text-gold-500"
            : "border-ink-700 text-ink-400"
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.5v5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <h1 className="text-xl font-semibold text-ink-100">{title}</h1>
      <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-ink-400">{detail}</p>
    </section>
  );
}
