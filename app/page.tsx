import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * There is no public marketing surface here. Guests arrive via /t/{token} from
 * a QR code; everyone else is staff and belongs in the dashboard.
 */
export default async function RootPage() {
  redirect((await getSession()) ? "/dashboard" : "/login");
}
