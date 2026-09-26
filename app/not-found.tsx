import Link from "next/link";

import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <Logo size={26} />
      </div>
      <h1 className="text-xl font-semibold text-cream">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-400">
        If you scanned a QR code, the link may have been mistyped. Ask a member of staff
        for a current one.
      </p>
      <Link href="/" className="mt-8 text-sm font-medium text-gold underline">
        Go to Splitcore
      </Link>
    </main>
  );
}
