import type { Metadata } from "next";

import { ComingSoon, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Payouts" };

/**
 * Deliberately empty — see transactions/page.tsx. No payouts endpoint exists.
 */
export default function PayoutsPage() {
  return (
    <>
      <PageHeader
        title="Payouts"
        description="What each entertainer is owed, what's been sent, and when."
      />
      <ComingSoon
        title="Payouts aren't available yet"
        blockedBy="The backend exposes no payouts endpoint. Entertainer bank details and KYC status are already captured under Entertainers, but payout amounts and their status need backend support that doesn't exist yet."
      />
    </>
  );
}
