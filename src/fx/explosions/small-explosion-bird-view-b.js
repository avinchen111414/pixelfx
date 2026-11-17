// Draft B: curved fire arms unwind from the core; each arm is a short chain of lumpy chunks (ref 2).
import { clamp, smooth, ease, TAU } from "../../core/index.js";
import { BASE_META, createBase, fireBlob } from "./_bird-view-lib.js";

export const meta = {
  ...BASE_META,
  name: "Bird's-eye explosion B - swirl arms",
  desc: "Five curved fire arms unwind from a hot core, each a chain of lumpy chunks that sweeps outwards and cools into embers.",
  tags: [...BASE_META.tags, "draft-b"],
};

export function create(o) {
  return createBase(o, (c) => {
    const R = c.R, F = c.F, FR = c.FR, S = c.S;
    const arms = Array.from({ length: 5 }, (_, i) => ({
      a: (TAU * i) / 5 + R.range(-0.18, 0.18), v: R.range(0.8, 1.25),
      twist: R.sign() * R.range(0.55, 1.0), fade: R.range(1.5, 2.3),
      joints: Array.from({ length: 5 }, (_, j) => ({
        s: R.range(9, 15) * (1 - j * 0.1), ph: R.range(0, TAU), t0: R.range(0, 0.08),
      })),
    }));
    return {
      draw(p, t) {
        if (t > 2.9) return;
        const k0 = 1 - smooth(1.6, 2.7, t);
        for (const arm of arms) {
          // The arm's radius only grows; the twist merely bends the path, it never pulls a chunk back in.
          const sweep = (1 - Math.exp(-t * 2.0 * arm.v)) * 88 * S;
          const turn = arm.twist * (1 - Math.exp(-t * 1.6));
          arm.joints.forEach((q, j) => {
            const u = Math.max(0, t - q.t0 - j * 0.03);
            const kk = k0 * (1 - smooth(arm.fade, arm.fade + 0.5, t)) * Math.min(1, u * 22);
            if (kk <= 0) return;
            const d = 7 * S + sweep * ((j + 1) / 5);
            const a = arm.a + turn * (j / 4) + Math.sin(t * 2.4 + j) * 0.03;
            const r = q.s * S * (0.55 + 0.45 * ease.outCubic(clamp(u / 0.18)));
            fireBlob(p, Math.cos(a) * d, Math.sin(a) * d, r, FR, F, q.ph + t * 0.6, kk, clamp(1 - u / 1.1), a + arm.twist * 0.45, 1.5);
          });
        }
      },
    };
  });
}
