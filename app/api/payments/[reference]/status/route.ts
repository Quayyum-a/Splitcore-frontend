import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getPaymentStatus } from "@/lib/api/guest";

/**
 * Server-side proxy for GET /payments/{reference}/status.
 *
 * The confirmation screen polls this instead of the backend directly: a browser
 * request to the backend carries an Origin header, which the deployed backend
 * answers with a 500 (docs/api-audit.md §4). Proxying also keeps the backend
 * URL out of the client bundle.
 *
 * The underlying endpoint is public and re-verifies CREATED/PENDING payments
 * against Paystack, so this is a genuine source of truth — not a guess made
 * from whatever Paystack put in the redirect query string.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  try {
    const status = await getPaymentStatus(reference);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.isNetworkError ? 503 : error.status },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
