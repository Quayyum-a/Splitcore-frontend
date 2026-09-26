"use server";

import { redirect } from "next/navigation";

import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createSession } from "@/lib/session";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  try {
    const { token, user } = await login(email, password);
    await createSession(token, user);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { error: "Invalid email or password." };
      if (error.status === 400) return { error: error.message };
      if (error.isNetworkError) {
        return {
          error:
            "Couldn't reach the Splitcore API. It may be waking up — try again in a moment.",
        };
      }
      return { error: error.message };
    }
    return {
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  // Outside the try: redirect throws a control-flow signal that must not be caught.
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/session");
  await destroySession();
  redirect("/login");
}
