import type { Metadata } from "next";

import { ComingSoon, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Transactions" };

/**
 * Deliberately empty. The backend exposes no endpoint that lists transactions
 * (docs/api-audit.md §2) — only GET /payments/{reference}/status, which needs a
 * reference you already have. Building a table here would mean inventing data.
 */
export default function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Time, amount, entertainer, guest, status and reference for every tip."
      />
      <ComingSoon
        title="Transaction history isn't available yet"
        blockedBy="The backend has no endpoint that lists transactions — only a per-reference status lookup. This page stays empty rather than showing numbers that aren't real. It needs a venue-scoped transactions endpoint before it can be built."
      />
    </>
  );
}
