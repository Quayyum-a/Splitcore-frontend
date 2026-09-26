import QRCode from "qrcode";

import { buildTipUrl } from "@/lib/app-url";
import { getSession } from "@/lib/session";

/**
 * Renders a scannable QR PNG for a public token.
 *
 * THE POINT OF THIS FILE: the encoded payload is buildTipUrl(token) — this
 * frontend's own /t/{token} URL — never the backend's. A QR pointing at the
 * backend resolves to raw JSON on a guest's phone. See README §"The fix".
 *
 * `?size=` controls pixel width; `?download=1` sets a filename so a venue can
 * save it straight onto a table-tent or sticker artwork.
 */
export const dynamic = "force-dynamic";

const DEFAULT_SIZE = 512;
const MAX_SIZE = 2048;
const MIN_SIZE = 128;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  // Tokens are public by design, but generating art for arbitrary tokens is a
  // staff action, so it sits behind the same session as the rest of the admin.
  if (!(await getSession())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { token } = await params;
  const url = new URL(request.url);

  const requested = Number(url.searchParams.get("size"));
  const size = Number.isFinite(requested)
    ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.trunc(requested)))
    : DEFAULT_SIZE;

  const target = buildTipUrl(token);

  const png = await QRCode.toBuffer(target, {
    type: "png",
    width: size,
    // Quiet zone. Print needs the margin or scanners struggle on a dark table.
    margin: 2,
    // 'M' tolerates a scuffed or partly-obscured sticker while keeping the
    // modules large enough to scan from arm's length in bad light.
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const download = url.searchParams.get("download") === "1";

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="splitcore-qr-${token.slice(0, 12)}.png"`,
          }
        : {}),
    },
  });
}
