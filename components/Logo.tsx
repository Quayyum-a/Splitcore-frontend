import Image from "next/image";

/**
 * The Splitcore mark.
 *
 * The gold "S" is the locked brand asset — lifted off its navy plate into
 * straight alpha (design/reference/) so it sits on any surface. The wordmark is
 * set as live type rather than shipped as art: the reference lockup renders its
 * wordmark in cream, which would vanish on the light admin surface, and live
 * type also stays crisp at any size and remains selectable and translatable.
 */

type Tone = "onDark" | "onLight";

const WORDMARK_TONE: Record<Tone, string> = {
  onDark: "text-cream",
  onLight: "text-slate-900",
};

export function Logo({
  variant = "lockup",
  tone = "onDark",
  size = 28,
  className = "",
}: {
  variant?: "lockup" | "mark";
  tone?: Tone;
  size?: number;
  className?: string;
}) {
  const mark = (
    <Image
      src="/logo-mark-96.png"
      alt=""
      width={size}
      height={size}
      priority
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );

  if (variant === "mark") {
    return (
      <span className={`inline-flex ${className}`} role="img" aria-label="Splitcore">
        {mark}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label="Splitcore"
    >
      {mark}
      <span
        className={`font-semibold ${WORDMARK_TONE[tone]}`}
        style={{
          // Matches the reference lockup: wide, even tracking, optical size
          // a little under the mark's cap height.
          fontSize: size * 0.58,
          letterSpacing: "0.14em",
          lineHeight: 1,
        }}
      >
        SPLITCORE
      </span>
    </span>
  );
}
