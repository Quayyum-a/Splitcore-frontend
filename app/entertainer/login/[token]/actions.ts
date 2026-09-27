"use server";

import { redirect } from "next/navigation";

import { createEntertainerSession, redeemLoginLink } from "@/lib/entertainer-session";

/**
 * Redeems the one-time link.
 *
 * Deliberately a POST action rather than work done while rendering the page:
 * the token is single use, and WhatsApp, iMessage and most SMS clients fetch a
 * URL to build a link preview. Burning it on GET would mean the preview bot
 * spends the entertainer's only login before they ever tap it.
 */
export async function redeemAction(token: string): Promise<{ error: string } | void> {
  const session = await redeemLoginLink(token);
  if (!session) {
    return {
      error:
        "This login link isn't valid. It may have expired, already been used, or been replaced by a newer one. Ask your venue to send a new one.",
    };
  }
  await createEntertainerSession(session);
  redirect("/entertainer");
}
