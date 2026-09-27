import "server-only";

import { apiFetch } from "./client";
import type { Bank } from "./types";

/**
 * The bank list behind every bank picker in the app.
 *
 * Returns `null` on failure rather than an empty array: an empty dropdown and
 * a dropdown that failed to load look identical to someone trying to get paid,
 * and only one of them is worth waiting out.
 *
 * The backend caches the provider list for 24 hours, so this is cached here for
 * an hour too — it is the same answer for every user and it is not money data.
 */
export async function getBanks(token: string): Promise<Bank[] | null> {
  try {
    const banks = await apiFetch<Bank[]>("/banks", { token, revalidate: 3600 });
    return Array.isArray(banks) && banks.length > 0 ? banks : null;
  } catch {
    return null;
  }
}
