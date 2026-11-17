// Draft C: thick flame tongues shoot out of a ragged hot heart (ref 1, frames 2-3).
import { clamp, smooth, ease, TAU } from "../../core/index.js";
import { BASE_META, createBase, fireBlob } from "./_bird-view-lib.js";

export const meta = {
  ...BASE_META,
  name: "Bird's-eye explosion C - flame tongues",
  desc: "Thick flame tongues shoot straight out of a small ragged hot heart; they only grow longer, then burn out into sparks.",
  tags: [...BASE_META.tags, "draft-c"],
};

export function create(o) {
  return createBase(o, (c) => {
    const R = c.R, F = c.F, FR = c.FR, S = c.S;
    const tongues = Array.from({ length: 13 }, (_, i) => ({
      a: (TAU * i) / 13 + R.range(-0.18, 0.18), L: R.range(0.62, 1.15),
      w: R.range(7, 12), t0: R.range(0, 0.05), ph: R.range(0, TAU),
    }));
    const heart = Array.from({ length: 4 }, () => ({
      a: R.range(0, TAU), d: R.range(0, 5), s: R.range(9, 13), ph: R.range(0, TAU),
    }));
    return {
      draw(p, t) {
        // Short and violent: letting thin spokes linger turns them into a "sun" badge.
        if (t > 1.2) return;
        const k = 1 - smooth(0.5, 1.1, t);
        if (k <= 0) return;
        const reach = 10 * S + 92 * S * ease.outQuart(clamp(t / 0.45));
        for (const q of tongues) {
          const u = clamp((t - q.t0) / 0.45);
          const d = Math.max(0, reach * q.L * ease.outQuart(u));
          const ca = Math.cos(q.a), sa = Math.sin(q.a), r0 = 7 * S;
          // The tongue starts outside the heart, so the centre never becomes a filled "sun" disc.
          p.beam(ca * r0, sa * r0, ca * d, sa * d, q.w * S * (0.85 + 0.5 * (1 - u)),
            (along, across) => (across < 0.35 ? FR[3] : across < 0.72 ? FR[4] : FR[6]), k);
          const r = q.w * S * 0.7 * (0.55 + 0.45 * ease.outCubic(clamp(t / 0.14)));
          fireBlob(p, ca * d, sa * d, r, FR, F, q.ph + t * 0.4, k, clamp(1 - t / 1.2), q.a, 2.0);
        }
        const hk = 1 - smooth(0.2, 0.7, t);
        for (const q of heart) {
          const r = q.s * S * (0.6 + 0.4 * ease.outCubic(clamp(t / 0.12)));
          fireBlob(p, Math.cos(q.a) * q.d * S, Math.sin(q.a) * q.d * S, r, FR, F, q.ph, k * hk, 1, q.a);
        }
      },
    };
  });
}
