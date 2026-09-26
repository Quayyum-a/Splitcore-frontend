import type { Metadata } from "next";

import { GuestShell } from "@/components/GuestShell";
import { getProposedTerms } from "@/lib/api/consent";

import { ConsentForm } from "./ConsentForm";

/**
 * Where an entertainer agrees (or refuses) the split a venue proposed.
 *
 * No login, by design: entertainers have no accounts, and requiring one to
 * agree terms would mean nobody ever agrees any. The token in the URL is the
 * authorization, which is the same trade the guest tipping page makes.
 *
 * The backend builds this exact URL as
 * `{FRONTEND_URL}/split-rules/{id}/respond/{token}` and hands it to the venue
 * dashboard to deliver — there is no notification channel yet.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your split" };

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = await params;
  const result = await getProposedTerms(id, token);

  if (result.kind === "invalid") {
    return (
      <GuestShell>
        <Message
          title="This approval link isn't valid."
          detail="It may have already been used, or the venue may have withdrawn the proposal. Ask them to send a new one."
        />
      </GuestShell>
    );
  }

  if (result.kind === "error") {
    return (
      <GuestShell>
        <Message
          title="We couldn't load these terms."
          detail="Check your connection and try again in a moment."
        />
      </GuestShell>
    );
  }

  return (
    <GuestShell>
      <ConsentForm splitRuleId={id} token={token} terms={result.terms} />
    </GuestShell>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="flex h-full flex-col items-center justify-center text-center">
      <span
        aria-hidden="true"
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-ink-700 text-ink-400"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <h1 className="text-xl font-semibold text-cream">{title}</h1>
      <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-ink-400">{detail}</p>
    </section>
  );
}
