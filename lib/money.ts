/**
 * Money handling.
 *
 * INVARIANT: every amount in this codebase is an integer number of kobo.
 * ₦1 = 100 kobo. Floating-point naira values must never exist — not in state,
 * not in props, not in arithmetic. Formatting to naira happens exactly once,
 * at the moment of display, via `formatNaira`.
 *
 * This mirrors the backend, which stores kobo integers for the same reason.
 */

/** Bounds enforced by the backend's InitializePaymentDto. See docs/api-audit.md §3.3. */
export const MIN_TIP_KOBO = 10_000; // ₦100
export const MAX_TIP_KOBO = 1_000_000_000; // ₦10,000,000

/** Preset tip amounts, in kobo. Product spec §5.1. */
export const PRESET_TIPS_KOBO = [100_000, 200_000, 500_000, 1_000_000] as const;

const NAIRA_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "symbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * The single place kobo becomes human-readable text.
 * Whole-naira amounts render without decimals (₦5,000); sub-naira precision is
 * preserved when present (₦1,500.50) rather than silently rounded away.
 */
export function formatNaira(kobo: number): string {
  if (!Number.isFinite(kobo)) return "—";
  const negative = kobo < 0;
  const abs = Math.abs(Math.trunc(kobo));
  const naira = Math.trunc(abs / 100);
  const remainder = abs % 100;

  const body =
    remainder === 0
      ? NAIRA_FORMATTER.format(naira)
      : NAIRA_FORMATTER.format(naira + remainder / 100);

  return negative ? `-${body}` : body;
}

/**
 * Parse guest keyboard input (naira) into integer kobo.
 * Returns null for anything that isn't a clean, in-range amount. Uses string
 * manipulation rather than `parseFloat(x) * 100` so that e.g. "1234.35" can
 * never land on 123434.99999 via binary floating point.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[,\s₦]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** Human-readable reason an amount is rejected, or null when it's valid. */
export function validateTipKobo(kobo: number | null): string | null {
  if (kobo === null) return "Enter a valid amount.";
  if (!Number.isInteger(kobo)) return "Enter a valid amount.";
  if (kobo < MIN_TIP_KOBO) return `Minimum tip is ${formatNaira(MIN_TIP_KOBO)}.`;
  if (kobo > MAX_TIP_KOBO) return `Maximum tip is ${formatNaira(MAX_TIP_KOBO)}.`;
  return null;
}

/** Basis points (10000 = 100%) → display percentage. Used by split rules. */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}
