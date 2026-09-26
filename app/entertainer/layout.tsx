import { Logo } from "@/components/Logo";
import { getEntertainerSession } from "@/lib/entertainer-session";

import { entertainerSignOutAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The entertainer's portal shares the guest screen's dark, phone-first
 * treatment: same audience, same conditions, and the same absence of any
 * account ceremony.
 */
export default async function EntertainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getEntertainerSession();

  return (
    <main className="flex min-h-dvh flex-col items-center bg-ink-950 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-[30rem] flex-1 flex-col">
        <header className="flex items-center justify-between pb-7">
          <Logo size={24} />
          {session ? (
            <form action={entertainerSignOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-300"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
