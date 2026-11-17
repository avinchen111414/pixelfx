// Draft D: a top-down view of a spherical fireball - a filled disc of chunks that all grow, cool and drift out.
import { clamp, smooth, mix, rgb, noise, TAU } from "../../core/index.js";
import { BASE_META, createBase, fireBlob } from "./_bird-view-lib.js";

// ---------------------------------------------------------------------------
// TUNE HERE. One CSS-style cubic-bezier drives the whole blast: the front's
// radius, each blob's size and its colour all read the same progress
// u = curve(t / life). x1/y1 and x2/y2 are the two control points (0..1 each):
// a small x1 with a large y1 gives a sharp start that eases out (fast, then slow).
//
//   linear:      { x1: 0.33, y1: 0.33, x2: 0.67, y2: 0.67 }
//   ease-out:    { x1: 0.10, y1: 0.80, x2: 0.36, y2: 1.00 }  <- default
//   very snappy: { x1: 0.02, y1: 0.95, x2: 0.22, y2: 1.00 }
//   soft start:  { x1: 0.45, y1: 0.55, x2: 0.80, y2: 0.95 }
// ---------------------------------------------------------------------------
export const CURVE = { x1: 0.10, y1: 0.80, x2: 0.36, y2: 1.00 };

export const TUNE = {
  life: 2.6,          // seconds for u to go 0 -> 1
  radius: [12, 96],   // front radius in local px, start -> end
  grow: [0.55, 1.25], // blob radius multiplier, start -> end
  ash: 0.65,          // how far the fire ramp mixes toward cool ash at u = 1 (0..1)
  stretch: 1.9,       // tangential stretch of the rim blobs
  fade: 0.80,         // u where the whole front starts dropping out (0..1)
  // A sphere seen from above projects to a filled disc, not just a rim. The body shell scatters chunks
  // continuously from the centre out to rf 0.92; the rim shell keeps the even fire front. rf is a chunk's
  // share of the front radius, s its base size, even spreads it evenly.
  shells: [
    { n: 14, rf: [0.04, 0.92], s: [15, 30], even: false },
    { n: 14, rf: [0.88, 1.10], s: [12, 18], even: true },
  ],
};

const ASH = rgb(46, 42, 54);

/** CSS cubic-bezier(x1,y1,x2,y2): invert the x polynomial by bisection, then evaluate y. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const cy = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, m = x;
    for (let i = 0; i < 20; i++) {
      m = (lo + hi) * 0.5;
      if (cx(m) < x) lo = m; else hi = m;
    }
    return cy(m);
  };
}

export const meta = {
  ...BASE_META,
  name: "Bird's-eye explosion D - fire front",
  desc: "A spherical fireball seen from above: chunks fill the centre as well as the rim, all growing, cooling and drifting outwards on a tunable easing curve.",
  tags: [...BASE_META.tags, "draft-d"],
};

export function create(o) {
  // --opts '{"curve":{...},"tune":{...}}' overrides the defaults without editing this file.
  const C = { ...CURVE, ...(o.curve ?? {}) }, T = { ...TUNE, ...(o.tune ?? {}) };
  const curve = cubicBezier(C.x1, C.y1, C.x2, C.y2);
  return createBase(o, (c) => {
    const R = c.R, FR = c.FR, S = c.S;
    const blobs = T.shells.flatMap((sh, si) =>
      Array.from({ length: sh.n }, (_, i) => ({
        a: sh.even ? (TAU * i) / sh.n + R.range(-0.22, 0.22) + si * 0.4 : R.range(0, TAU),
        rf: R.range(sh.rf[0], sh.rf[1]), s: R.range(sh.s[0], sh.s[1]),
        ph: R.range(0, TAU), v: R.range(0.94, 1.06), f: R.range(-0.05, 0.05),
        st: sh.even ? T.stretch : T.stretch * 0.75,
      }))
    );
    return {
      draw(p, t) {
        const u = curve(clamp(t / T.life));
        const k = 1 - smooth(T.fade, 1, u);
        if (k <= 0.02) return;
        // One progress drives everything: radius out, size up, colour down, fast at first then slow.
        const R0 = (T.radius[0] + (T.radius[1] - T.radius[0]) * u) * S;
        // Hard pixels cannot use alpha (the painter dithers it into a checkerboard), so "fading" means
        // mixing the whole fire ramp toward ash. Every layer keeps its own step instead of collapsing
        // into one flat dark-red disc.
        const ramp = FR.map((col) => mix(col, ASH, u * T.ash));
        if (k > 0.35) p.ring(0, 0, R0, (12 - 6 * u) * S,
          (v, ang) => ramp[noise(ang * 6 + 1.3, 4) > 0.1 ? 6 : 5],
          (v, ang) => (noise(ang * 9, 7) > -0.35 ? 1 : 0));
        for (const q of blobs) {
          // Stagger the burn-out so the front does not vanish on a single frame.
          const kk = 1 - smooth(T.fade + q.f, 1 + q.f, u);
          if (kk <= 0.16) continue;
          const d = R0 * q.rf * q.v, a = q.a + Math.sin(t * 1.3 + q.ph) * 0.03;
          const r = q.s * S * (T.grow[0] + (T.grow[1] - T.grow[0]) * u);
          // Stretched tangentially on the rim, rounder near the centre, as a sphere's projection suggests.
          fireBlob(p, Math.cos(a) * d, Math.sin(a) * d, r, ramp, ramp, q.ph + t * 0.5, kk, clamp(1 - u), a + Math.PI / 2, q.st);
        }
      },
    };
  });
}
