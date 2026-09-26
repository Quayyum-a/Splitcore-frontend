/**
 * Regenerates every brand asset in public/ from the locked art in
 * design/reference/. Run with `npm run brand`.
 *
 * The reference art is the gold mark on a navy plate with a faint woven
 * pattern. This lifts the mark into straight alpha (keying on hue as well as
 * brightness, so the pattern doesn't survive), crops it square, and emits the
 * favicon set, the app tiles, the header mark and the Open Graph card.
 */
import { PNG } from "pngjs";
import fs from "node:fs";

const OUT = "/Users/user/Splitcore/splitcore-frontend/public";
const REF = "/Users/user/Splitcore/splitcore-frontend/design/reference";
const lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Lift the gold mark off its navy plate into straight alpha, keeping antialiased edges. */
function keyOutNavy(src) {
  const out = new PNG({ width: src.width, height: src.height });
  const BG_LUM = 38, FG_LUM = 145;           // measured: plate ~24-40, gold core ~150
  const bg = [26, 22, 44];                    // #1a162c, the dominant plate colour
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    let a = (lumOf(r, g, b) - BG_LUM) / (FG_LUM - BG_LUM);
    a = Math.max(0, Math.min(1, a));
    // Gate on hue as well as brightness. The plate carries a woven pattern in
    // warm-neutral navy that is brighter than its surround and would survive a
    // luminance-only key. Gold always runs red-over-blue; the navy never does,
    // so this erases the pattern while leaving antialiased gold edges intact.
    a *= Math.max(0, Math.min(1, (r - b) / 30));
    if (a < 0.02) { out.data[i] = out.data[i+1] = out.data[i+2] = out.data[i+3] = 0; continue; }
    // Un-mix the plate back out so edge pixels aren't muddied toward navy.
    const un = (c, bgc) => Math.max(0, Math.min(255, (c - bgc * (1 - a)) / a));
    out.data[i] = un(r, bg[0]);
    out.data[i+1] = un(g, bg[1]);
    out.data[i+2] = un(b, bg[2]);
    out.data[i+3] = Math.round(a * 255);
  }
  return out;
}

function bbox(png, minAlpha = 130) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    const r = png.data[i], g = png.data[i+1], b = png.data[i+2];
    // Gold, not just "brighter than the plate": the reference art has a faint
    // woven pattern in the corners that keys in at low alpha and would
    // otherwise drag the bounding box out to the image edge.
    const isGold = r > 140 && g > 90 && b < g * 0.9 && r > b + 50;
    if (png.data[i + 3] >= minAlpha && isGold) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Square crop around the mark with proportional breathing room. */
function squareCrop(png, box, padRatio) {
  const side = Math.round(Math.max(box.w, box.h) * (1 + padRatio * 2));
  const cx = box.x0 + box.w / 2, cy = box.y0 + box.h / 2;
  const ox = Math.round(cx - side / 2), oy = Math.round(cy - side / 2);
  const out = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const sx = ox + x, sy = oy + y, d = (y * side + x) * 4;
    if (sx < 0 || sy < 0 || sx >= png.width || sy >= png.height) { out.data[d+3] = 0; continue; }
    const s = (sy * png.width + sx) * 4;
    out.data[d] = png.data[s]; out.data[d+1] = png.data[s+1];
    out.data[d+2] = png.data[s+2]; out.data[d+3] = png.data[s+3];
  }
  return out;
}

/** Box-average downsample — correct for big reductions where bilinear aliases. */
function resize(src, size) {
  const out = new PNG({ width: size, height: size });
  const sx = src.width / size, sy = src.height / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const s = (yy * src.width + xx) * 4, sa = src.data[s+3] / 255;
      r += src.data[s] * sa; g += src.data[s+1] * sa; b += src.data[s+2] * sa;
      a += src.data[s+3]; n++;
    }
    const d = (y * size + x) * 4, aa = a / n;
    const w = aa === 0 ? 0 : (a / 255);
    out.data[d]   = w === 0 ? 0 : Math.round(r / w);
    out.data[d+1] = w === 0 ? 0 : Math.round(g / w);
    out.data[d+2] = w === 0 ? 0 : Math.round(b / w);
    out.data[d+3] = Math.round(aa);
  }
  return out;
}

/** Flatten onto an opaque plate — apple-touch-icon must not be transparent. */
function onPlate(src, hex) {
  const [pr, pg, pb] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = new PNG({ width: src.width, height: src.height });
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i+3] / 255;
    out.data[i]   = Math.round(src.data[i] * a + pr * (1 - a));
    out.data[i+1] = Math.round(src.data[i+1] * a + pg * (1 - a));
    out.data[i+2] = Math.round(src.data[i+2] * a + pb * (1 - a));
    out.data[i+3] = 255;
  }
  return out;
}

const write = (png, name) => {
  fs.writeFileSync(`${OUT}/${name}`, PNG.sync.write(png));
  console.log(`  ${name.padEnd(28)} ${png.width}x${png.height}`);
};

const src = PNG.sync.read(fs.readFileSync(`${REF}/splitcore-icon-only.png`));
const keyed = keyOutNavy(src);
const box = bbox(keyed);
console.log(`mark bbox: ${box.w}x${box.h} at (${box.x0},${box.y0}) of ${src.width}x${src.height}`);

// Tight crop for tiny sizes so the S fills the glyph box; roomier for app tiles.
const tight = squareCrop(keyed, box, 0.06);
const roomy = squareCrop(keyed, box, 0.20);

console.log("transparent marks:");
write(resize(tight, 512), "icon-mark.png");
write(resize(tight, 16), "favicon-16x16.png");
write(resize(tight, 32), "favicon-32x32.png");
write(resize(tight, 48), "favicon-48x48.png");
console.log("plated tiles:");
write(onPlate(resize(roomy, 180), "#161429"), "apple-touch-icon.png");
write(onPlate(resize(roomy, 192), "#161429"), "icon-192.png");
write(onPlate(resize(roomy, 512), "#161429"), "icon-512.png");
// Header-sized mark: the 512 is far too heavy to ship for a 28px logo.
write(resize(tight, 96), "logo-mark-96.png");

/* ---- favicon.ico: a container of PNG frames (every browser since IE11) ---- */
/* ---- favicon.ico: a container of PNG frames ---- */
const frames = [16, 32, 48].map((s) => ({
  size: s,
  data: fs.readFileSync(`${OUT}/favicon-${s}x${s}.png`),
}));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);              // reserved
header.writeUInt16LE(1, 2);              // type 1 = icon
header.writeUInt16LE(frames.length, 4);

let offset = 6 + frames.length * 16;
const dir = Buffer.concat(frames.map((f) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(f.size === 256 ? 0 : f.size, 0);  // width  (0 means 256)
  e.writeUInt8(f.size === 256 ? 0 : f.size, 1);  // height
  e.writeUInt8(0, 2);                            // palette size
  e.writeUInt8(0, 3);                            // reserved
  e.writeUInt16LE(1, 4);                         // colour planes
  e.writeUInt16LE(32, 6);                        // bits per pixel
  e.writeUInt32LE(f.data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += f.data.length;
  return e;
}));

fs.writeFileSync(
  `${OUT}/favicon.ico`,
  Buffer.concat([header, dir, ...frames.map((f) => f.data)]),
);
console.log(`favicon.ico  ${frames.map((f) => f.size).join("/")}  ${fs.statSync(`${OUT}/favicon.ico`).size} bytes`);

{
/* ---- Open Graph card, from the authoritative wordmark art ---- */
  const ogSrc = PNG.sync.read(fs.readFileSync(`${REF}/splitcore-logo-full-wordmark.png`));
  const TARGET_W = 1200, TARGET_H = 630;
  const targetAspect = TARGET_W / TARGET_H;

// Centre-crop to the OG aspect first so the resize can't squash the wordmark.
  let cw = ogSrc.width, ch = Math.round(ogSrc.width / targetAspect);
if (ch > ogSrc.height) { ch = ogSrc.height; cw = Math.round(ogSrc.height * targetAspect); }
  const ox = Math.round((ogSrc.width - cw) / 2), oy = Math.round((ogSrc.height - ch) / 2);

  const og = new PNG({ width: TARGET_W, height: TARGET_H });
  const sx = cw / TARGET_W, sy = ch / TARGET_H;
  for (let y = 0; y < TARGET_H; y++) for (let x = 0; x < TARGET_W; x++) {
  const x0 = ox + Math.floor(x * sx), x1 = ox + Math.max(Math.floor(x * sx) + 1, Math.floor((x + 1) * sx));
  const y0 = oy + Math.floor(y * sy), y1 = oy + Math.max(Math.floor(y * sy) + 1, Math.floor((y + 1) * sy));
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const s = (yy * ogSrc.width + xx) * 4;
    r += ogSrc.data[s]; g += ogSrc.data[s + 1]; b += ogSrc.data[s + 2]; n++;
  }
  const d = (y * TARGET_W + x) * 4;
  og.data[d] = Math.round(r / n); og.data[d + 1] = Math.round(g / n);
  og.data[d + 2] = Math.round(b / n); og.data[d + 3] = 255;
}
  fs.writeFileSync(`${OUT}/og-image.png`, PNG.sync.write(og));
  console.log(`og-image.png ${TARGET_W}x${TARGET_H}  ${Math.round(fs.statSync(`${OUT}/og-image.png`).size / 1024)} KB`);
}
