// Draft A: ragged fire chunks burst out of the centre, overlap into one cloud, then peel off outwards (ref 1).
import { clamp, smooth, ease, TAU } from "../../core/index.js";
import { BASE_META, createBase, fireBlob } from "./_bird-view-lib.js";

export const meta = {
  ...BASE_META,
  name: "Bird's-eye explosion A - burst cloud",
  desc: "Uneven, radially stretched fire chunks burst out of the centre as one cloud, then separate and stream outwards as they cool.",
  tags: [...BASE_META.tags, "draft-a"],
};

export function create(o) {
  return createBase(o, (c) => {
    const R = c.R, F = c.F, FR = c.FR, S = c.S;
    const chunks = Array.from({ length: 18 }, () => ({
      a: R.range(0, TAU), v: R.range(0.35, 1.35), s: R.range(9, 17),
      t0: R.range(0, 0.06), fade: R.range(1.5, 2.3), ph: R.range(0, TAU), bend: R.range(-0.22, 0.22),
    }));
    return {
      draw(p, t) {
        if (t > 2.9) return;
        const k0 = 1 - smooth(1.6, 2.7, t);
        for (const q of chunks) {
          const u = Math.max(0, t - q.t0);
          const kk = k0 * (1 - smooth(q.fade, q.fade + 0.55, t)) * Math.min(1, u * 24);
          if (kk <= 0) continue;
          // Every chunk only ever moves away from the centre; the envelope grows monotonically.
          const d = 3 * S + 96 * S * (1 - Math.exp(-u * 2.1 * q.v));
          const a = q.a + q.bend * (1 - Math.exp(-u * 2));
          // Chunks grow to full size and stay: shrinking them reads as the blast collapsing back inwards.
          const r = q.s * S * (0.55 + 0.45 * ease.outCubic(clamp(u / 0.16)));
          fireBlob(p, Math.cos(a) * d, Math.sin(a) * d, r, FR, F, q.ph + u * 0.5, kk, clamp(1 - u / 1.1), a, 1.5);
        }
      },
    };
  });
}
