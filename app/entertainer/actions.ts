"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  confirmAccount,
  resolveAccount,
  submitBankDetails,
  verifyIdentity,
} from "@/lib/api/kyc";
import {
  destroyEntertainerSession,
  getEntertainerSession,
} from "@/lib/entertainer-session";

export interface KycActionState {
  error: string | null;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Ask your venue for a new link.";
    if (error.status === 409) return "That step is already done.";
    if (error.isNetworkError) return "Couldn't reach Splitcore. Check your connection.";
    // 400s here carry the backend's own reason — "the bank could not resolve
    // them", "the name does not match". Those are the useful words.
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

async function requireEntertainer() {
  const session = await getEntertainerSession();
  if (!session) redirect("/entertainer");
  return session;
}

export async function submitBankDetailsAction(
  _previous: KycActionState,
  formData: FormData,
): Promise<KycActionState> {
  const bankName = String(formData.get("bankName") ?? "").trim();
  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (!bankName) return { error: "Enter your bank's name." };
  if (!/^\d{3,6}$/.test(bankCode)) return { error: "Enter your bank's code (3 to 6 digits)." };
  if (!/^\d{10}$/.test(accountNumber)) {
    return { error: "A Nigerian account number is exactly 10 digits." };
  }

  try {
    const { token, entertainerId } = await requireEntertainer();
    await submitBankDetails(token, entertainerId, { bankName, bankCode, accountNumber });
    revalidatePath("/entertainer");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

export async function resolveAccountAction(
  _previous: KycActionState,
): Promise<KycActionState> {
  try {
    const { token, entertainerId } = await requireEntertainer();
    await resolveAccount(token, entertainerId);
    revalidatePath("/entertainer");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

/**
 * The confirmation posts back the name the bank returned, as rendered on the
 * screen the entertainer is looking at. The backend re-checks it against its
 * own record, so a stale page can't confirm an account that has since changed.
 */
export async function confirmAccountAction(
  _previous: KycActionState,
  formData: FormData,
): Promise<KycActionState> {
  const confirmedAccountName = String(formData.get("confirmedAccountName") ?? "").trim();
  if (!confirmedAccountName) return { error: "Nothing to confirm yet." };

  try {
    const { token, entertainerId } = await requireEntertainer();
    await confirmAccount(token, entertainerId, confirmedAccountName);
    revalidatePath("/entertainer");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

export async function verifyIdentityAction(
  _previous: KycActionState,
  formData: FormData,
): Promise<KycActionState> {
  const documentType = String(formData.get("documentType") ?? "");
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();

  if (documentType !== "BVN" && documentType !== "NIN") {
    return { error: "Choose BVN or NIN." };
  }
  if (!/^\d{11}$/.test(documentNumber)) {
    return { error: `A ${documentType} is exactly 11 digits.` };
  }

  try {
    const { token, entertainerId } = await requireEntertainer();
    // The number goes straight to the provider and is never stored, logged or
    // returned. It must not be put anywhere but this one request.
    await verifyIdentity(token, entertainerId, { documentType, documentNumber });
    revalidatePath("/entertainer");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

export async function entertainerSignOutAction(): Promise<void> {
  await destroyEntertainerSession();
  redirect("/");
}
