// origin 章的時間軸：一切狀態都由 p 決定（可任意跳）。單位：1 = 約 300 nm（MVB 半徑 1）。
// 世界座標：作用點的細胞膜是 y=0 平面，y<0 是細胞質，y>0 是胞外；剖面在 z=0。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const lerp = (a, b, k) => a + (b - a) * k;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Catmull-Rom（非等距鍵）：keys = [[p, v0, v1, ...], ...]
export function sample(keys, p, out) {
  const n = keys.length;
  if (p <= keys[0][0]) { for (let j = 1; j < keys[0].length; j++) out[j - 1] = keys[0][j]; return out; }
  if (p >= keys[n - 1][0]) { for (let j = 1; j < keys[0].length; j++) out[j - 1] = keys[n - 1][j]; return out; }
  let i = 0; while (i < n - 2 && p > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
  const h = k2[0] - k1[0], u = (p - k1[0]) / h, u2 = u * u, u3 = u2 * u;
  const a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, c = -2 * u3 + 3 * u2, d = u3 - u2;
  for (let j = 1; j < k1.length; j++) {
    const m1 = (k2[j] - k0[j]) / Math.max(k2[0] - k0[0], 1e-6), m2 = (k3[j] - k1[j]) / Math.max(k3[0] - k1[0], 1e-6);
    out[j - 1] = a * k1[j] + b * h * m1 + c * k2[j] + d * h * m2;
  }
  return out;
}

// ── MSC 外形（細胞座標 u 沿長軸、v 橫向、高度 h；同一比例尺，全長約 150 µm）
const L = 250;
export const CELL = { L, us: 62, vn: 0.25 };
export const cellW = u => {
  const a = Math.min(Math.abs(u) / L, 1);
  return (40 * Math.exp(-((u / 62) ** 2)) + 7 * Math.pow(1 - a, 0.8) * (1 + 0.25 * Math.sin(u * 0.05))
    + 9 * Math.exp(-(((Math.abs(u) - 232) / 11) ** 2))) * (1 + 0.06 * Math.sin(u * 0.21 + 1.3) + 0.04 * Math.sin(u * 0.53)) + 0.2;
};
export const cellV0 = u => 18 * Math.sin(u * 0.009) - 9 * (u / L) ** 2;
export const cellH = (u, vn) => {
  const a = Math.min(Math.abs(u) / L, 1), w = cellW(u), v = vn * w;
  return (2.2 + 26 * Math.exp(-(u * u / 3025 + v * v / 676))) * Math.pow(Math.max(1 - vn * vn, 0), 0.6) * (0.35 + 0.65 * (1 - a));
};
CELL.hs = cellH(CELL.us, CELL.vn);
CELL.vs = cellV0(CELL.us) + CELL.vn * cellW(CELL.us);
// 細胞座標 → 世界座標（作用點的背側膜落在原點）
export const cellToWorld = (u, y, v, out, o = 0) => { out[o] = u - CELL.us; out[o + 1] = y - CELL.hs; out[o + 2] = v - CELL.vs; return out; };
export const NUCLEUS = { u: 0, y: 11.5, v: cellV0(0), ru: 30, ry: 8.5, rv: 20 };

// ── 主角內體（腔）的中心與半徑
export const EZ = -0.12;
const E_KEYS = [
  [0.00, -3.2, 2.2, 0.62],
  [0.19, -3.2, 2.0, 0.62],   // 還在膜外：膜是平的
  [0.30, -3.2, -0.73, 0.62], // 深凹、頸部收窄
  [0.335, -3.15, -1.15, 0.66], // 掐斷
  [0.42, -2.35, -3.3, 1.0],  // 成熟變大
  [0.52, -2.2, -3.5, 1.0],   // 向內出芽期間停留
  [0.60, 0.4, -2.8, 1.0],    // 沿微管往周邊（正端）
  [0.68, 3.0, -2.1, 1.0],
  [0.725, 3.4, -1.2, 1.0],   // 靠上細胞膜
  [0.78, 3.4, -0.72, 1.0],   // 融合孔張開
  [0.90, 3.4, -0.25, 0.97],
  [1.00, 3.4, 0.35, 0.9],    // 完全併入、攤平
];
const _e = [0, 0, 0];
export function endosome(p, out) { sample(E_KEYS, p, _e); out.set(_e[0], _e[1], EZ, Math.max(_e[2], 0.3)); return out; }

// 微管軌道（主角那一根）
export const TRACK = (() => {
  const tx = 5.2 / Math.hypot(5.2, 1.4), ty = 1.4 / Math.hypot(5.2, 1.4);
  const gap = 0.36;
  return { tx, ty, nx: -ty, ny: tx, ox: -2.2 + ty * (1 + gap), oy: -3.5 - tx * (1 + gap), z: EZ, gap };
})();

// ── 腔內囊泡 ILV
export const N_ILV = 14;
export function makeILV() {
  const r = rng(71), list = [];
  let guard = 0;
  while (list.length < N_ILV && guard++ < 20000) {
    const rad = 0.135 + 0.06 * r();
    const lim = 1 - rad - 0.11;
    const x = (r() * 2 - 1) * lim, y = (r() * 2 - 1) * lim, z = lerp(-lim, 0.2, r());
    const len = Math.hypot(x, y, z);
    if (len > lim || len < 0.16) continue;
    if (list.some(o => Math.hypot(o.x - x, o.y - y, o.z - z) < o.rad + rad + 0.07)) continue;
    list.push({ x, y, z, rad, len, a: r(), b: r(), c: r(), d: r() });
  }
  // 停得深的先出芽；靠上方的先釋放
  const byDepth = [...list].sort((a, b) => a.len - b.len);
  byDepth.forEach((o, i) => { o.tb = 0.365 + 0.165 * i / (list.length - 1); });
  const byTop = [...list].sort((a, b) => b.y - a.y);
  byTop.forEach((o, i) => { o.tr = 0.762 + 0.105 * i / (list.length - 1); });
  return list;
}

// 算出每顆 ILV 的世界位置與半徑（未出芽的半徑設 -1 = 不存在），並回傳群組包圍球與已釋放的重心
export function updateILV(list, p, t, E, out, G, rel, wob = 1) {
  let n = 0, gx = 0, gy = 0, gz = 0, rn = 0, rx = 0, ry = 0, rz = 0;
  const R = E.w;
  for (let i = 0; i < list.length; i++) {
    const o = list[i], v = out[i], b = (p - o.tb) / 0.075;
    if (b <= 0) { v.set(E.x, E.y, E.z, -1); continue; }
    const nx = o.x / o.len, ny = o.y / o.len, nz = o.z / o.len;
    const rho0 = R + o.rad + 0.2, rhoP = R - o.rad - 0.09, rest = o.len * R;
    let rho;
    if (b < 0.72) rho = lerp(rho0, rhoP, smooth(0, 0.72, b));
    else rho = lerp(rhoP, rest, smooth(0.72, 1.6, b));
    const settle = smooth(0.8, 1.6, b) * wob;
    let x = E.x + nx * rho + 0.03 * settle * Math.sin(t * (0.5 + o.a) + o.b * 40);
    let y = E.y + ny * rho + 0.03 * settle * Math.sin(t * (0.45 + o.c) + o.d * 40);
    let z = E.z + nz * rho + 0.02 * settle * Math.sin(t * (0.4 + o.b) + o.a * 40);
    const e = p - o.tr;
    if (e > 0) {
      const px = E.x + (o.a - 0.5) * 0.3, py = 0.1, pz = E.z - o.b * 0.25;
      const w = smooth(0, 0.035, e);
      x = lerp(x, px, w); y = lerp(y, py, w); z = lerp(z, pz, w);
      const tau = Math.max(e - 0.03, 0);
      if (tau > 0) {
        x += 60 * Math.pow(tau, 1.3) * (0.6 + 0.7 * o.c);
        y += (0.9 + 3.6 * o.d) * (1 - Math.exp(-tau * 15)) + 0.12 * wob * Math.sin(t * (0.3 + o.a * 0.4) + o.c * 30) * smooth(0, 0.05, tau);
        z += -(0.15 + 1.7 * o.a) * (1 - Math.exp(-tau * 11));
        rn++; rx += x; ry += y; rz += z;
      }
    }
    v.set(x, y, z, o.rad);
    n++; gx += x; gy += y; gz += z;
  }
  if (!n) { G.set(E.x, E.y, E.z, -1); } else {
    gx /= n; gy /= n; gz /= n; let m = 0;
    for (let i = 0; i < list.length; i++) { const v = out[i]; if (v.w > 0) m = Math.max(m, Math.hypot(v.x - gx, v.y - gy, v.z - gz) + v.w); }
    G.set(gx, gy, gz, m + 0.28);
  }
  if (rn) rel.set(rx / rn, ry / rn + 0.5, rz / rn); else rel.set(E.x + 0.4, 1.0, 0);
}

// ── 鏡頭：[p, tx, ty, tz, ln(d), 方位角°, 仰角°, 光圈]
export function makeCamKeys() {
  const z0 = -CELL.vs * 0.85;
  const K = (p, x, y, z, d, az, el, ap) => [p, x, y, z, Math.log(d), az, el, ap];
  return [
    K(0.00, -52, -3, z0, 310, -14, 50, 0.004),
    K(0.09, -46, -3, z0, 265, -7, 42, 0.004),
    K(0.16, -28, -2, z0 * 0.4, 140, 4, 30, 0.005),
    K(0.22, -6, -0.6, 0, 30, 12, 12, 0.007),
    K(0.27, -3.2, -0.5, 0, 9.5, 14, -3, 0.011),
    K(0.31, -3.2, -0.8, 0, 8.2, 12, -4, 0.012),
    K(0.36, -2.9, -2.0, 0, 7.6, 4, -1, 0.012),
    K(0.45, -2.25, -3.4, 0, 5.6, -10, 8, 0.013),
    K(0.52, -2.2, -3.45, 0, 6.2, -12, 6, 0.013),
    K(0.60, 0.4, -2.9, 0, 8, -16, 3, 0.012),
    K(0.68, 2.9, -1.8, 0, 8, -4, -3, 0.012),
    K(0.75, 3.4, -0.7, 0, 6.6, 10, -5, 0.012),
    K(0.80, 3.5, -0.2, 0, 7, 12, 2, 0.012),
    K(0.92, 6.2, 2.1, -0.5, 12, 6, 7, 0.010),
    K(1.00, 11, 3.0, -1, 17, 0, 6, 0.009),
  ];
}
