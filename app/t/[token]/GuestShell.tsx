import { Logo } from "@/components/Logo";

/**
 * The frame every guest screen sits in: dark, centred, phone-first, with a
 * comfortable max width so it doesn't sprawl if someone opens it on a laptop.
 */
export function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]">
      {/* A single soft stage-light wash. Pure CSS — no image to download on
          club wifi, and it disappears behind content rather than competing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(247,181,44,0.16),transparent_70%)]"
      />
      <div className="relative flex w-full max-w-[26rem] flex-1 flex-col">
        <header className="flex justify-center pb-8 text-ink-400">
          <Logo />
        </header>
        {children}
      </div>
    </main>
  );
}
