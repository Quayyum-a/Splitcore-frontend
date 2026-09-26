import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/session";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main
      data-surface="admin"
      className="flex min-h-dvh items-center justify-center bg-slate-100 px-5 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size={34} tone="onLight" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Venue sign in</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">
            Manage entertainers, QR codes and splits.
          </p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Guests don&rsquo;t need an account — they just scan a code.
        </p>
      </div>
    </main>
  );
}
