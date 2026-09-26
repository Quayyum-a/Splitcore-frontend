import { Logo } from "@/components/Logo";

/**
 * The frame every guest screen sits in.
 *
 * Solid #08080a throughout — no gradient, no background image, nothing that
 * costs a paint. A guest opens this one-handed in a dark room on club data;
 * the fastest possible first screen is a design requirement, not a nicety.
 */
export function GuestShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  /** Pinned to the bottom of the viewport, above the safe area. */
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-ink-950 px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-[26rem] flex-1 flex-col">
        <header className="flex justify-center pb-7">
          <Logo size={26} />
        </header>

        <div className={footer ? "flex-1 pb-4" : "flex-1 pb-[max(2rem,env(safe-area-inset-bottom))]"}>
          {children}
        </div>

        {footer ? (
          <div className="sticky bottom-0 -mx-5 bg-ink-950 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
