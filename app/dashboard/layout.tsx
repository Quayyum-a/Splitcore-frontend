import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/session";

import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

/**
 * Auth gate. Checked here rather than in middleware because the session cookie
 * is encrypted and decrypting it needs Node crypto, not the edge runtime.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const NAV = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/qr-codes", label: "QR codes" },
    { href: "/dashboard/entertainers", label: "Entertainers" },
    { href: "/dashboard/split-rules", label: "Split rules" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/payouts", label: "Payouts" },
  ];

  return (
    <div data-surface="admin" className="min-h-dvh bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/dashboard" className="text-slate-900">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            {session.user.email ? (
              <span className="hidden text-sm text-slate-500 sm:inline">
                {session.user.email}
              </span>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-5">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-slate-600 hover:border-slate-300 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
