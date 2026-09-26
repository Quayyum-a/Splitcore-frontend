import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GuestShell } from "@/components/GuestShell";
import { getEntertainerSession } from "@/lib/entertainer-session";

import { OpenPortal } from "./OpenPortal";

/**
 * Where an entertainer's one-time login link lands.
 *
 * The backend builds this URL as `{FRONTEND_URL}/entertainer/login/{token}`.
 * Nothing is redeemed by rendering — see actions.ts for why.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function EntertainerLoginPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Already signed in: don't spend a second link for nothing.
  if (await getEntertainerSession()) redirect("/entertainer");

  return (
    <GuestShell>
      <OpenPortal token={token} />
    </GuestShell>
  );
}
