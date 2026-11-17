// A bird's-eye view of the ground blast in small-explosion.js: the same fire puffs, sparks, smoke, stones and
// scorch, but seen straight down. Every motion is radial instead of rising, shockwaves are full circles, and the
// burn spreads across a floor that has no horizon. This is the sy = 1 case of the projection described in
// docs/PERSPECTIVE_CHN.md: the ground is not squashed, so rings stay round, and height h has no screen
// displacement. The particle recipe is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, GRAVITY, SMOKE_RAMP, Rng, fit, clamp, smooth, ease, rand, noise, TAU, WHITE, rgb, mix } from "../../core/index.js";
import { fireRamp, heatRamp, lobe, rock, stone, SOOT, SOOT2 } from "./_lib.js";

export const meta = {
  name: "Explosion (bird's-eye view)",
  desc: "Seen from above: a white flash, circular shock rings, a ring of fire cooling into drifting smoke, sparks and stones thrown every way, and a round scorch left on the floor.",
  tags: ["explosion", "fire", "smoke", "debris", "impact", "top-down", "one-shot"],
  size: [288, 288],
  origin: [144, 144],
  duration: 4.2,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], stone: "#4a3f69", size: 1, seed: 7 },
};

const WARM = rgb(255, 176, 96);
const SHOCK = 118;       // how far the fast circular shockwave reaches
const CLOUD = 66;        // where the cloud of fire settles
const SCORCH = 46;       // radius of the burn left on the floor
const COOL = 2.5;        // seconds for the scorch to cool down to soot
const FADE = [2.9, 4.0]; // when the mark on the floor fades away
const LIMIT = 138;       // particles must stay inside this radius, including their own width

/** Soft puffs thin out over the last 26 px; hard bits die at the rim, so nothing crosses the canvas edge. */
function keepInside(ps) {
  for (let i = ps.list.length - 1; i >= 0; i--) {
    const q = ps.list[i];
    const soft = q.k === P.SMOKE || q.k === P.DUST || q.k === P.VAPOUR;
    const d = Math.hypot(q.x, q.y) + (soft ? q.size * 1.75 + 3 : 10);
    if (d >= LIMIT) { ps.list.splice(i, 1); continue; }
    if (soft && d > LIMIT - 26) q.life = Math.min(q.life, q.max * 0.45 * clamp((LIMIT - d) / 26));
  }
}

/**
 * There is no "up" in a top-down view. Cancel the particle system's built-in gravity and buoyancy before it
 * steps, so fire, smoke and sparks keep the direction they were thrown in and only slow down.
 */
function planar(ps, dt) {
  for (const q of ps.list) {
    if (q.delay > 0) continue;
    switch (q.k) {
      case P.FIRE: q.vy += 95 * dt; break;
      case P.SMOKE: q.vy += (q.flag & PF.BIG ? 23 : 16) * dt; break;
      case P.SPARK: q.vy -= GRAVITY * 0.45 * dt; break;
      case P.GRIT:
        q.vy -= GRAVITY * dt;
        q.vx -= q.vx * 1.2 * dt;
        q.vy -= q.vy * 1.2 * dt;
        break;
      case P.FLAKE: q.vy -= 35 * dt; break;
      default:
        if (q.k === P.VAPOUR || q.k === P.DUST || q.k === P.STAR) q.vy += 5 * dt;
    }
  }
}

/** A small top-down flame puff: a single solid ramp step that blends into the fire shell, with no upward
 *  tongue and no rim that would read as a separate ball at this size. */
function fireDisc(p, q, FR) {
  const k = q.life / q.max, age = 1 - k, n = FR.length, x = q.x, y = q.y;
  const heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1);
  const idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
  const r = q.size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = FR[idx];
  if (idx >= n - 2) return p.disc(x, y, r, c, Math.min(1, k * 3) * 0.85);
  p.circle(x, y, r, c);
  if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, 0.18 * k);
}

/** One particle layer, with the FIRE puffs replaced by their top-down silhouettes. */
function drawLayer(p, ps, layer, FR) {
  const all = ps.list, fires = [], rest = [];
  for (const q of all) (q.k === P.FIRE ? fires : rest).push(q);
  ps.list = rest;
  ps.draw(p, layer);
  ps.list = all;
  if (layer === "front") for (const q of fires) if (q.delay <= 0) fireDisc(p, q, FR);
}

/** The floor under the blast: a round burn that opens in a blink, glows white-hot, then cools to soot. Once it
 *  has cooled it is a plain dark disc, which keeps the long tail of the effect cheap to draw. */
function scorchDisc(p, HR, t, r0, fade) {
  if (fade <= 0) return;
  const r = Math.max(1, r0 * Math.min(1, t / 0.07)), n = HR.length;
  if (t < 1.4) {
    p.shade(-r - 2, -r - 2, r + 2, r + 2, (x, y, out) => {
      const d = Math.hypot(x, y) / r;
      if (d > 1.12) return;
      const ang = Math.atan2(y, x);
      const edge = 0.94 + 0.06 * noise(ang * 4 + 1.7, 11) + 0.035 * noise(ang * 11, 12);
      if (d > edge) return;
      const k = rand(Math.floor(x * 2), Math.floor(y * 2), 3);
      const T = Math.pow(clamp(1 - t / COOL), 1.4) * (1.25 - d) - k * 0.3;
      if (T > 0.07) {
        out.c = HR[Math.min(n - 1, Math.floor((1 - Math.min(1, T)) * (n - 1)))];
        out.a = fade;
        if (k > 0.94) (out.l = out.c), (out.k = 0.14 * T * fade);
      } else {
        out.c = d < 0.45 ? SOOT : SOOT2;
        out.a = (d < 0.86 - k * 0.2 ? 1 : Math.max(0, (edge - d) / 0.14)) * fade;
      }
    });
  } else {
    p.shade(-r, -r, r, r, (x, y, out) => {
      const d = Math.hypot(x, y) / r;
      if (d > 0.94) return;
      out.c = d < 0.45 ? SOOT : SOOT2;
      out.a = fade;
    });
  }
  // a charred rim round the burn: hot at first, then just a dark ring so the floor does not look like a sigil
  p.ring(0, 0, r, 1.3, t < 0.9 ? HR[Math.min(n - 1, 3 + Math.floor(t * 3))] : SOOT2, fade * (t < 0.9 ? 0.7 : 0.45));
}

/** Cracks radiating out of the crater: bright seams at first, dark furrows left in the soot afterwards. */
function cracks(p, HR, t, r0, fade, list) {
  const heat = Math.pow(clamp(1 - t / (COOL * 1.5)), 1.2);
  if (fade <= 0 || heat <= 0.02) return;
  const c = HR[Math.min(HR.length - 1, 2 + Math.floor((1 - heat) * 6))];
  for (const q of list) {
    const bend = (d) => noise(d * 0.16 + q.w, 9) * 0.3, a0 = fade * (0.4 + 0.6 * heat);
    let px = Math.cos(q.a) * 4, py = Math.sin(q.a) * 4;
    for (let d = 4; d < q.L; d += 1.6) {
      const a = q.a + bend(d), x = Math.cos(a) * d, y = Math.sin(a) * d;
      p.beam(px, py, x, y, 1.5, c, a0 * (1 - (d / q.L) * 0.5));
      px = x;
      py = y;
    }
    const d = q.L * q.fork, a = q.a + bend(d), b = a + 0.45;
    p.beam(Math.cos(a) * d, Math.sin(a) * d, Math.cos(b) * (d + r0 * 0.18), Math.sin(b) * (d + r0 * 0.18), 1.2, c, a0 * 0.5);
  }
}

/** Two circular shockwaves: a fast white one with a dark outer rim, then a slower orange one. Both break up
 *  round their circumference so they read as a blast rather than a drawn circle. */
function shock(p, t, F, S) {
  const u = t / 0.42;
  if (u < 1) {
    const r = 6 + (SHOCK * S - 6) * ease.outCubic(u), w = Math.max(1.5, 5 * (1 - u));
    p.ring(0, 0, r + 2, w + 2.5, SOOT, 0.5 * (1 - u));
    p.ring(0, 0, r, w, (v, ang) => (u < 0.28 || (v > 0.5 && noise(ang * 7, 5) > 0.15) ? WHITE : F[6]),
      (v, ang) => {
        const n = noise(ang * 11 + 2, 7);
        return n < -0.4 ? 0 : Math.min(1, 1.3 - u) * (0.55 + 0.45 * n);
      });
    p.glowRing(0, 0, r, 9, F[4], 0.45 * (1 - u));
  }
  const v = (t - 0.05) / 0.62;
  if (v > 0 && v < 1) {
    const r = 5 + 88 * S * ease.outQuart(v);
    p.ring(0, 0, r, Math.max(1, 2.6 * (1 - v)), (x, ang) => (noise(ang * 5, 8) > 0.25 ? F[3] : F[2]),
      (x, ang) => (noise(ang * 13, 9) < -0.45 ? 0 : (1 - v * 0.75) * (0.6 + 0.4 * noise(ang * 9, 6))));
    p.glowRing(0, 0, r, 5, F[2], 0.22 * (1 - v));
  }
}

/** The hero frame's spokes: short white rays shot out of the core, gone before the fire cloud opens. */
function spokes(p, t, list, F, S) {
  if (t >= 0.24) return;
  const u = t / 0.24, k = Math.pow(1 - u, 1.5), L = ease.outExpo(Math.min(1, u * 1.7));
  for (const q of list) {
    const d = q.L * S * (0.3 + 0.7 * L), x = Math.cos(q.a) * d, y = Math.sin(q.a) * d;
    p.beam(0, 0, x, y, q.w, (v) => (v < 0.4 ? WHITE : v < 0.72 ? F[6] : F[4]), (v) => k * (1 - v * 0.55));
  }
}

/** The fireball seen from above: a white-hot heart inside a ragged shell of flame that swells, hollows out and
 *  cools through hard ramp steps. Uneven tongues and a torn rim keep it from reading as a perfect disc. */
function fireRing(p, t, F, FR, S) {
  if (t >= 0.72) return;
  const u = t / 0.72, R = (9 + 62 * S * ease.outQuart(clamp(u * 1.4))) * (1 - u * 0.12) * (1 - 0.4 * smooth(0.45, 1, u));
  // collapse and darken rather than dither away: a big half-transparent checkerboard looks like dirt
  const inner = R * (0.04 + 0.5 * ease.outCubic(u)), a0 = 1 - smooth(0.82, 1, u);
  p.shade(-R - 4, -R - 4, R + 4, R + 4, (x, y, out) => {
    const d = Math.hypot(x, y), ang = Math.atan2(y, x);
    const edge = R * (0.88 + 0.16 * noise(ang * 3 + t * 3, 3) + 0.09 * noise(ang * 11 - t * 6, 7));
    const hole = inner * (0.85 + 0.25 * noise(ang * 6, 9));
    if (d > edge || d < hole) return;
    const v = clamp((d - hole) / (edge - hole) + noise(ang * 7 + d * 0.13 + t * 4, 5) * 0.1 + u * 0.6);
    out.c = v < 0.18 ? FR[1] : v < 0.38 ? FR[2] : v < 0.58 ? FR[3] : v < 0.76 ? FR[4] : FR[6];
    out.a = a0;
  });
  for (let i = 0; i < 18; i++) {
    const ang = (TAU * i) / 18 + noise(i, 17) * 0.7;
    const L = R * Math.abs(noise(ang * 8 + t * 2, 13)) * 0.55 * (1 - u);
    if (L < R * 0.06) continue;
    const d0 = R * 0.82, d1 = R + L, c = FR[Math.min(6, 2 + Math.floor(u * 3))];
    p.beam(Math.cos(ang) * d0, Math.sin(ang) * d0, Math.cos(ang) * d1, Math.sin(ang) * d1,
      1.6 * (1 - u) + 0.6, (v) => (v < 0.4 ? FR[1] : c), a0 * 0.75);
  }
  p.glow(0, 0, R * 1.7 + 18, F[4], 0.34 * a0);
}

/** Smoke takes over only after the flame dies: scattered lobes swell, drift out, shrink and thin away. */
function cloud(p, t, lobes, FR, SM, S) {
  const rise = smooth(0.35, 0.9, t);
  if (rise <= 0) return;
  const spread = 6 + CLOUD * S * ease.outQuart(clamp(t / 0.85));
  for (const q of lobes) {
    const fade = 1 - smooth(q.fade - 0.9, q.fade + 0.4, t);
    if (fade <= 0.01) continue;
    const age = clamp((t - 0.35) / 1.2), d = Math.min(94 * S, spread * q.rf + t * 20 * q.grow * S), a = q.a + q.turn * t;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const r = q.s * S * (0.4 + 1.35 * ease.outCubic(age)) * (1 + 0.7 * clamp(t / 2)) * (1 - 0.4 * smooth(1.8, 3.2, t));
    lobe(p, x, y, r, FR, SM, 0, 0, fade * rise * 0.45, q.z, q.rf > 0.85 ? 1 : 0, 0);
  }
}

/** A few cinders still flickering in the scorch after the flame has gone. */
function embers(p, t, F, list, fade) {
  if (fade <= 0 || t < 0.35 || t > 3.5) return;
  const k = fade * clamp(1 - (t - 2.6) / 0.9);
  for (const q of list) {
    const tw = 0.55 + 0.45 * Math.sin(t * q.sp + q.ph);
    if (tw < 0.45) continue;
    p.dot(q.x, q.y, tw > 0.85 ? F[6] : F[4], k * tw);
    p.glow(q.x, q.y, 5, F[3], 0.12 * k * tw);
  }
}

export function create(o) {
  const F = fit(o.palette, 8), FR = fireRamp(F), HR = heatRamp(FR);
  const SM = SMOKE_RAMP.map((c) => mix(c, SOOT, 0.45)); // darker smoke: it must not read as a ring of bubbles
  const S = clamp(o.size, 0.6, 1.2), R = new Rng(o.seed), st = stone(o.stone);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [F[7], F[6], F[5], F[3]], haze: F[3] });
  const lights = new Lights();
  lights.add(0, 0, 128 * S, WARM, 0.55, 0.75);
  lights.add(0, 0, 52 * S, WHITE, 0.8, 0.09);
  lights.add(0, 0, 88 * S, F[3], 0.28, 1.7);
  lights.add(0, 0, 60 * S, F[2], 0.14, 3.0);

  // lobes scattered across the whole blast, not strung round one radius: the golden angle keeps them spread,
  // the radius factor keeps them from forming a neat necklace. Far ones first so near ones sit in front.
  const lobes = Array.from({ length: 18 }, (_, i) => ({
    a: i * 2.39996 + R.range(-0.35, 0.35),
    rf: Math.pow(R.range(0.18, 1), 0.75) * R.range(0.85, 1.15),
    grow: R.range(0.7, 1.35), turn: R.range(-0.14, 0.14),
    s: R.range(7, 13), fade: R.range(1.8, 3.2), z: R.range(-0.6, 0.6),
  })).sort((x, y) => x.z - y.z);
  const spokesData = Array.from({ length: 13 }, (_, i) => ({
    a: (TAU * i) / 13 + R.range(-0.2, 0.2), L: R.range(30, 78), w: R.range(1, 2.4),
  }));
  const cracksData = Array.from({ length: 9 }, () => ({
    a: R.range(0, TAU), L: SCORCH * S * R.range(0.65, 1.3), w: R.range(0, 80), fork: R.range(0.4, 0.8),
  }));
  // earth scattered round the crater by the blast, left lying on the floor
  const scatter = Array.from({ length: 64 }, () => {
    const a = R.range(0, TAU), d = SCORCH * S * R.range(0.95, 2.2);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, c: R.pick([st.shade, st.body, st.light]), t0: R.range(0.08, 0.32) };
  });
  const emberData = Array.from({ length: 14 }, () => {
    const a = R.range(0, TAU), d = SCORCH * S * R.range(0.2, 0.85);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, sp: R.range(8, 22), ph: R.range(0, TAU) };
  });
  // stones that fly off, slow to a stop and cool; their shadows stay on the floor
  const rocks = Array.from({ length: 24 }, () => {
    const ang = R.range(0, TAU), v = R.range(65, 190) * S;
    return { ang, d: R.range(2, 12) * S, v, v0: v, a: R.range(0, TAU), spin: R.sign() * R.range(6, 16),
      s: R.int(1, 3), life: R.range(2.1, 3.1), heat: R.range(0.55, 1.05), x: 0, y: 0 };
  });

  // small fire puffs riding the blast wave and cooling into smoke: all go outwards, none rise
  for (let i = 0; i < 16; i++) {
    const a = R.range(0, TAU), d = R.range(0, 10 * S), sp = R.range(35, 135) * S;
    ps.spawn(P.FIRE, Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp,
      R.range(0.35, 0.8), 0, R.range(2.5, 5) * S, 0, PF.SMOKES | PF.BIG);
  }
  // a low ring of dust and smoke rolling out over the floor: this carries the smoke now that the flame is gone
  for (let i = 0; i < 30; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 110) * S;
    ps.spawn(P.SMOKE, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.9, 2.9), st.dust,
      R.range(9, 15) * S, R.range(0.04, 0.3), PF.BIG);
  }
  for (let i = 0; i < 36; i++) {
    const a = R.range(0, TAU), sp = R.range(60, 150) * S;
    ps.spawn(R.chance(0.55) ? P.DUST : P.VAPOUR, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp,
      R.range(0.8, 1.7), st.dust, R.range(3, 6.5) * S, R.range(0, 0.15));
  }
  // sparks, motes and glints: a full 360 degrees, each slowing with drag
  for (let i = 0; i < 105; i++) {
    const a = R.range(0, TAU), sp = R.range(140, 330) * S;
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.7));
  }
  for (let i = 0; i < 30; i++) {
    const a = R.range(0, TAU), sp = R.range(55, 150) * S;
    ps.spawn(P.MOTE, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.35, 0.85),
      R.pick([F[6], F[5], F[4]]), R.range(0.7, 1.3));
  }
  for (let i = 0; i < 14; i++) {
    const a = R.range(0, TAU), sp = R.range(30, 100) * S;
    ps.spawn(P.STAR, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.5, 1.2),
      R.chance(0.5) ? WHITE : F[5], R.range(0.5, 1.5), R.range(0.05, 0.7));
  }
  // loose earth skidding over the floor
  for (let i = 0; i < 76; i++) {
    const a = R.range(0, TAU), sp = R.range(45, 165) * S;
    ps.spawn(P.GRIT, Math.cos(a) * R.range(0, 4), Math.sin(a) * R.range(0, 4), Math.cos(a) * sp, Math.sin(a) * sp,
      R.range(1.0, 1.9), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      planar(ps, dt);
      ps.update(dt);
      keepInside(ps);
      for (let i = rocks.length - 1; i >= 0; i--) {
        const b = rocks[i];
        if ((b.life -= dt) <= 0) { rocks.splice(i, 1); continue; }
        b.v -= b.v * 2.6 * dt;
        b.d += b.v * dt;
        b.x = Math.cos(b.ang) * b.d;
        b.y = Math.sin(b.ang) * b.d;
        b.a += b.spin * (b.v / b.v0) * dt;
        b.heat = Math.max(0, b.heat - dt * 1.2);
      }
      lights.update(dt);
    },
    drawBack(p) {
      const fade = 1 - smooth(FADE[0], FADE[1], t);
      p.glow(0, 0, 90 * S, F[3], 0.2 * clamp(1 - t / 1.6));
      p.glow(0, 0, 42 * S, F[5], 0.16 * clamp(1 - t / 0.8));
      scorchDisc(p, HR, t, SCORCH * S, fade);
      cracks(p, HR, t, SCORCH * S, fade, cracksData);
      embers(p, t, F, emberData, fade);
      if (fade > 0) for (const g of scatter) if (t > g.t0) p.dot(g.x, g.y, g.c, fade * 0.85);
      const u = t / 0.6;
      if (u < 1 && fade > 0) p.ring(0, 0, 18 + 78 * S * ease.outCubic(u), Math.max(1, 3.5 * (1 - u)), SOOT, (1 - u) * fade * 0.5);
      drawLayer(p, ps, "back", FR);
    },
    draw(p) {
      shock(p, t, F, S);
      fireRing(p, t, F, FR, S);
      cloud(p, t, lobes, FR, SM, S);
      for (const b of rocks) {
        const a = Math.min(1, b.life / 0.6);
        p.dot(b.x + 1.8, b.y + 2.4, SOOT, 0.55 * a);
        p.dot(b.x + 2.8, b.y + 1.4, SOOT, 0.3 * a);
        rock(p, b, st, FR);
      }
      drawLayer(p, ps, "front", FR);
      spokes(p, t, spokesData, F, S);
      if (t < 0.13) {
        const u = t / 0.13, r = (16 + 30 * S * ease.outCubic(u)) * (1 - u * 0.2);
        p.circle(0, 0, r, (d) => (d < 0.55 ? WHITE : d < 0.82 ? FR[1] : FR[3]), 1 - u * 0.3);
        p.circle(0, 0, r * 0.5, WHITE, 1 - u * 0.5);
        p.glow(0, 0, r * 2.2 + 12, F[5], 0.6 * (1 - u));
      }
      lights.draw(p);
    },
  };
}
