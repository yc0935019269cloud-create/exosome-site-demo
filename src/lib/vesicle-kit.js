// 共用：囊泡建模（實例化磷脂雙層、四次跨膜蛋白、腔內貨物）、珍珠／皂膜材質、失焦粒子、幾何小工具。
// 單位：囊泡外半徑 = 1（約 50 nm），膜厚 0.1（約 5 nm），所以 1 nm ≈ 0.02。
import * as THREE from 'three';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

export function makeRng(seed) {
  let a = seed >>> 0;
  const f = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += f(); return (u - 2) * 1.732; };
  f.dir = (out = new V3()) => { const y = f() * 2 - 1, r = Math.sqrt(Math.max(0, 1 - y * y)), p = f() * TAU; return out.set(r * Math.cos(p), y, r * Math.sin(p)); };
  return f;
}

export const COLORS = {
  cd9: new THREE.Color('#f2b84b'), cd63: new THREE.Color('#3fc7b0'), cd81: new THREE.Color('#9b8cff'),
  rna: new THREE.Color('#ff7a59'), bg: new THREE.Color('#07090c'),
};

// ───────────────────────── 幾何小工具 ─────────────────────────
// 只存位置與 tint，法線最後統一算（頂點共用，所以表面平滑）。面的繞向不保證，材質一律雙面並把法線翻向鏡頭。
export class Geo {
  constructor() { this.p = []; this.t = []; this.i = []; }
  get n() { return this.p.length / 3; }
  sphere(c, r, tint = 1, w = 10, h = 7, sx = 1, sy = 1, sz = 1) {
    const b = this.n;
    this.p.push(c.x, c.y + r * sy, c.z); this.t.push(tint);
    for (let j = 1; j < h; j++) {
      const th = Math.PI * j / h, y = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < w; k++) { const ph = TAU * k / w; this.p.push(c.x + r * s * Math.cos(ph) * sx, c.y + r * y * sy, c.z + r * s * Math.sin(ph) * sz); this.t.push(tint); }
    }
    this.p.push(c.x, c.y - r * sy, c.z); this.t.push(tint);
    const last = this.n - 1;
    for (let k = 0; k < w; k++) {
      const k2 = (k + 1) % w;
      this.i.push(b, b + 1 + k2, b + 1 + k);
      for (let j = 0; j < h - 2; j++) { const a = b + 1 + j * w + k, a2 = b + 1 + j * w + k2, c1 = a + w, c2 = a2 + w; this.i.push(a, c2, c1, a, a2, c2); }
      this.i.push(last, last - w + k, last - w + k2);
    }
    return this;
  }
  // pts: Vector3[]；rad: 數字或 (u 沿長度 0..1, th 繞軸角) => 半徑
  tube(pts, rad, seg = 6, tint = 1, cap = true) {
    const n = pts.length, b = this.n, T = new V3(), N = new V3(1, 0, 0), B = new V3();
    const rf = typeof rad === 'function' ? rad : () => rad;
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
      if (i === 0 && Math.abs(T.x) > .9) N.set(0, 1, 0);
      N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N);
      const u = i / (n - 1), q = pts[i];
      for (let k = 0; k < seg; k++) {
        const th = TAU * k / seg, r = rf(u, th), c = Math.cos(th) * r, s = Math.sin(th) * r;
        this.p.push(q.x + N.x * c + B.x * s, q.y + N.y * c + B.y * s, q.z + N.z * c + B.z * s); this.t.push(tint);
      }
      if (cap && (i === 0 || i === n - 1)) {
        const sg = i === 0 ? -1 : 1, r = rf(u, 0) * .7; const ci = this.n;
        this.p.push(q.x + T.x * r * sg, q.y + T.y * r * sg, q.z + T.z * r * sg); this.t.push(tint);
        // 中心點插在環後面，索引要避開：記下來最後接扇形
        (this._caps ||= []).push([ci, i === 0 ? b : ci - seg, seg, sg]);
      }
    }
    // 環的起點索引：頭環後面多一個中心點，所以第 i 環起點要位移
    const off = i => b + i * seg + (cap && i > 0 ? 1 : 0);
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
      const a = off(i) + k, a2 = off(i) + (k + 1) % seg, c1 = off(i + 1) + k, c2 = off(i + 1) + (k + 1) % seg;
      this.i.push(a, c1, a2, a2, c1, c2);
    }
    if (this._caps) { for (const [ci, r0, sg2] of this._caps) for (let k = 0; k < sg2; k++) this.i.push(ci, r0 + k, r0 + (k + 1) % sg2); this._caps = null; }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.t, 1));
    g.setIndex(this.i); g.computeVertexNormals();
    return g;
  }
}
export const spline = (ctrl, n) => new THREE.CatmullRomCurve3(ctrl, false, 'centripetal').getPoints(n);

// ───────────────────────── GLSL 共用片段 ─────────────────────────
// 膜的共同位移：環境起伏 + 指標凹陷 + 漣漪。所有長在膜上的東西都用同一支，才不會分家。
export const GLSL_MEMBRANE = /* glsl */`
uniform float uTime;
uniform float uWob;
uniform vec4 uHit;      // xyz 物件空間單位方向，w 強度（彈簧，可為負）
uniform vec4 uRip[4];   // xyz 方向，w 年齡秒（<0 停用）
uniform vec4 uCut;      // xyz 裁切法線（物件空間），w 門檻：dot(dir,n) > w 的膜被切掉
vec3 mGrad;
float mWave(vec3 d, float t) {
  return sin(d.x * 2.3 + d.y * 1.7 + t * .41) * .42 + sin(d.y * 3.1 - d.z * 2.6 + t * .33 + 1.7) * .30
       + sin(d.z * 4.3 + d.x * 3.4 - t * .52 + 4.1) * .18 + sin(dot(d, vec3(6.1, -5.3, 4.7)) + t * .77 + 2.3) * .10;
}
// 回傳 xyz 切向位移、w 徑向位移；mGrad 是徑向位移的切向梯度（拿來歪法線）
vec4 membraneDisp(vec3 d) {
  float r = uWob * .013 * mWave(d, uTime);
  vec3 dh = d - uHit.xyz; vec3 dt = dh - d * dot(dh, d);
  float c2 = dot(dh, dh), ch = sqrt(c2 + 1e-6);
  float g = exp(-c2 / .085);
  float env = exp(-c2 * 3.5) * (1. - g);
  float ph = ch * 30. - uTime * 8.;
  r += uHit.w * (-.07 * g + .007 * sin(ph) * env);
  mGrad = dt / ch * (uHit.w * (.07 * g * 2. * ch / .085 + .21 * cos(ph) * env));
  vec3 tg = dt * (uHit.w * .2 * g);
  for (int i = 0; i < 4; i++) {
    float a = uRip[i].w;
    if (a > 0.) {
      vec3 e = d - uRip[i].xyz; float cr = length(e) + 1e-4, x = cr - a * .75;
      float en = .011 * exp(-x * x * 30. - a * 1.3);
      r += en * sin(x * 24.);
      mGrad += (e - d * dot(e, d)) / cr * (en * (24. * cos(x * 24.) - 60. * x * sin(x * 24.)));
    }
  }
  return vec4(tg, r);
}
void tangentFrame(vec3 d, out vec3 T, out vec3 B) {
  vec3 up = abs(d.y) > .97 ? vec3(1., 0., 0.) : vec3(0., 1., 0.);
  T = normalize(cross(up, d)); B = cross(d, T);
}
`;

// 觀察空間的燈、薄膜干涉、珍珠著色、霧
export const GLSL_SHADE = /* glsl */`
uniform vec4 uFog;       // rgb 霧色，a 密度
uniform float uFogStart;
const vec3 L_KEY = vec3(-.549, .619, .561);
const vec3 L_FILL = vec3(.707, -.354, .612);
const vec3 L_BACK = vec3(.530, .265, -.806);
const vec3 C_KEY = vec3(1., .955, .9);
const vec3 C_FILL = vec3(.34, .52, .56);
const vec3 C_BACK = vec3(.62, .46, .9);
// 薄膜干涉：c 入射角餘弦，d 光學厚度（nm）
vec3 thinFilm(float c, float d) {
  float opd = 2. * d * sqrt(max(1. - (1. - c * c) / 1.77, 0.));
  vec3 I = .5 - .5 * cos(6.28318 * opd / vec3(650., 532., 450.));
  return mix(vec3(dot(I, vec3(.333))), I, .82);
}
// N 細節法線、Nm 巨觀法線、V 視線、film 薄膜厚度、alb 底色、k 虹彩與邊緣項的強度
vec3 pearlShade(vec3 N, vec3 Nm, vec3 V, float film, vec3 alb, float k) {
  float ndv = clamp(dot(Nm, V), 0., 1.);
  float dif = pow(clamp(dot(N, L_KEY) * .5 + .5, 0., 1.), 1.8);
  float fil = clamp(dot(N, L_FILL) * .5 + .5, 0., 1.);
  vec3 tf = thinFilm(ndv, film);
  vec3 a = alb * mix(vec3(1.), tf * 1.3 + .3, .3 * k);
  vec3 col = a * (vec3(.04, .048, .058) + C_KEY * dif * .58 + C_FILL * fil * fil * .2);
  float fr = pow(1. - ndv, 3.);
  col += tf * (fr * .5 + .03) * k;
  float bk = pow(clamp(dot(N, L_BACK) * .5 + .5, 0., 1.), 2.);
  col += C_BACK * bk * pow(1. - ndv, 1.5) * .45 * k;
  vec3 H = normalize(L_KEY + V);
  col += C_KEY * (pow(max(dot(N, H), 0.), 70.) * .5 + pow(max(dot(Nm, H), 0.), 10.) * .12 * k);
  return col;
}
// 一般霧面分子（蛋白、RNA）：半蘭伯 + 邊緣光
vec3 matteShade(vec3 N, vec3 V, vec3 alb, float glow) {
  float ndv = clamp(dot(N, V), 0., 1.);
  float dif = pow(clamp(dot(N, L_KEY) * .5 + .5, 0., 1.), 1.6);
  float fil = clamp(dot(N, L_FILL) * .5 + .5, 0., 1.);
  vec3 col = alb * (vec3(.07, .075, .09) + C_KEY * dif * .85 + C_FILL * fil * fil * .25);
  float rim = pow(1. - ndv, 2.6);
  col += alb * rim * (.35 + glow) + C_BACK * rim * .12;
  vec3 H = normalize(L_KEY + V);
  col += C_KEY * pow(max(dot(N, H), 0.), 28.) * .16;
  return col + alb * glow * .35;
}
vec3 applyFog(vec3 c, float dist) { return mix(c, uFog.rgb, 1. - exp(-max(dist - uFogStart, 0.) * uFog.a)); }
`;

// ───────────────────────── 分子幾何 ─────────────────────────
// 局部座標：y = 徑向朝外，y=0 是膜中央；膜佔 y∈[-0.05, 0.05]
function glycan(g, base, dir, n, rnd) {
  const p = base.clone(), d = dir.clone().normalize(), side = new V3();
  for (let i = 0; i < n; i++) {
    p.addScaledVector(d, .0092); g.sphere(p, .0056, -1, 6, 4);
    d.add(rnd.dir(side).multiplyScalar(.35)).normalize();
    if (i === 2) { // 分岔（N-醣鏈的雙觸角）
      const q = p.clone(), e = d.clone().add(rnd.dir(side).multiplyScalar(.9)).normalize();
      for (let k = 0; k < Math.max(2, n - 3); k++) { q.addScaledVector(e, .0092); g.sphere(q, .0052, -1, 6, 4); }
    }
  }
}

// 四次跨膜蛋白：四根 α 螺旋束 + 小胞外環 SEL + 大胞外環 LEL，N、C 端都在腔內
function tetraspaninGeo(kind, seed) {
  const rnd = makeRng(seed), g = new Geo(), a = .0128, tilt = .17;
  const H = [[-a, -a], [a, -a], [a, a], [-a, a]];
  const at = (k, y) => { const [x, z] = H[k], l = Math.hypot(x, z); return new V3(x - z / l * tilt * y, y, z + x / l * tilt * y); };
  const yTop = [.058, .058, .09, .09], yBot = -.06;
  for (let k = 0; k < 4; k++) {
    const pts = [], n = 24, turns = k < 2 ? 5 : 6.3, ph = rnd() * TAU;
    for (let i = 0; i <= n; i++) pts.push(at(k, yBot + (yTop[k] - yBot) * i / n));
    g.tube(pts, (u, th) => .0088 * (1 + .2 * Math.cos(th - u * turns * TAU + ph)) * Math.min(1, .55 + 6 * Math.min(u, 1 - u)), 8, .8);
  }
  const top = k => at(k, yTop[k]), bot = k => at(k, yBot);
  // SEL：TM1→TM2 的小胞外環
  g.tube(spline([top(0), new V3(-a * .5, .08, -a - .011), new V3(a * .5, .083, -a - .012), top(1)], 14), .0046, 5, 1.05, false);
  // 胞內小環：TM2→TM3
  g.tube(spline([bot(1), new V3(a + .012, -.073, -a * .4), new V3(a + .012, -.074, a * .4), bot(2)], 12), .0044, 5, .95, false);
  // N 端、C 端：都在腔內
  const cLen = kind === 1 ? .034 : .02;
  g.tube(spline([bot(0), new V3(-a - .011, -.073, -a - .004), new V3(-a - .021, -.068, -a + .008), new V3(-a - .024, -.079, -a + .017)], 12), .0042, 5, 1.0);
  g.tube(spline([bot(3), new V3(-a - .004, -.075, a + .01), new V3(-a + .007, -.073 - cLen * .5, a + .019), new V3(-a + .002, -.07 - cLen, a + .01)], 12), .0042, 5, 1.0);
  // LEL：TM3、TM4 往上延伸成柄，頂上是球狀頭部
  const S = (x, y, z, r, sy = 1) => g.sphere(new V3(x, y, z), r, 1.1, 10, 7, 1, sy, 1);
  if (kind === 0) { // CD9：較小、緊湊
    S(.008, .101, .012, .0165); S(-.007, .104, .011, .0155); S(.004, .113, -.001, .0145); S(-.009, .107, -.007, .0125); S(.013, .106, -.002, .0125);
    glycan(g, new V3(.012, .112, .008), new V3(.6, .7, .3), 5, rnd);
  } else if (kind === 1) { // CD63：最大，三條 N-醣鏈
    S(.009, .102, .013, .018); S(-.008, .105, .012, .017); S(.003, .117, .002, .0175); S(-.011, .111, -.008, .015); S(.015, .109, -.004, .0145);
    S(.0, .128, -.006, .0135); S(-.004, .121, .013, .012); S(.012, .122, .008, .011);
    glycan(g, new V3(.016, .118, .012), new V3(.8, .5, .4), 6, rnd);
    glycan(g, new V3(-.014, .119, .006), new V3(-.8, .5, .1), 6, rnd);
    glycan(g, new V3(.002, .136, -.008), new V3(.1, .9, -.4), 5, rnd);
  } else { // CD81：蕈狀，柄細、蓋寬，無醣鏈
    S(.0, .1, .012, .011);
    for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + .4; S(Math.cos(an) * .0155, .111 + .002 * Math.sin(an * 2), .004 + Math.sin(an) * .0155, .0135, .8); }
    S(.0, .118, .004, .0165, .75);
  }
  return g.build();
}

// 整合素類的大型異二聚體：兩根跨膜螺旋、兩條腿、頂端頭部（不標註）
function integrinGeo(seed) {
  const rnd = makeRng(seed), g = new Geo();
  for (const s of [-1, 1]) {
    const x = s * .011, pts = [];
    for (let i = 0; i <= 14; i++) pts.push(new V3(x, -.058 + .116 * i / 14, 0));
    g.tube(pts, (u, th) => .0086 * (1 + .18 * Math.cos(th - u * 5.2 * TAU)), 7, .78);
    g.tube(spline([new V3(x, -.058, 0), new V3(x * 1.6, -.075, .006 * s), new V3(x * 2.2, -.092, -.004)], 8), .0042, 5, .9);
    // 腿：一串結構域，中段有膝
    const leg = [[x * 1.1, .078, 0, .019], [x * 1.5, .108, .008 * s, .018], [x * 2.1, .136, .016 * s, .017], [x * 1.7, .166, .012 * s, .018], [x * 1.3, .195, .004 * s, .019]];
    for (const [lx, ly, lz, r] of leg) g.sphere(new V3(lx, ly, lz), r, 1, 10, 7);
  }
  g.sphere(new V3(-.02, .236, .0), .037, 1.08, 14, 9, 1, .8, 1);   // α：β-propeller
  g.sphere(new V3(.022, .232, .006), .03, 1.02, 12, 8);            // β：βI 結構域
  g.sphere(new V3(.034, .205, .012), .019, .98, 10, 7);
  glycan(g, new V3(-.045, .25, .01), new V3(-.8, .5, .2), 6, rnd);
  glycan(g, new V3(.04, .255, -.01), new V3(.6, .7, -.3), 5, rnd);
  glycan(g, new V3(-.03, .15, .02), new V3(-.7, .2, .6), 5, rnd);
  return g.build();
}

function glycanGeo(seed) {
  const rnd = makeRng(seed), g = new Geo();
  glycan(g, new V3(0, .046, 0), new V3(rnd.range(-.3, .3), 1, rnd.range(-.3, .3)), 6, rnd);
  return g.build();
}

// 球狀蛋白：沿一條彎曲脊線的凹凸團塊（分子表面感）
function blobGeo(seed, { len, r0, bend = 0, lobe = 0, seg = 16, rings = 20 }) {
  const rnd = makeRng(seed), g = new Geo(), pts = [];
  for (let i = 0; i <= rings; i++) { const u = i / rings - .5; pts.push(new V3(u * len, bend * len * (.25 - u * u) * 2, Math.sin(u * 5 + seed) * len * .04)); }
  const f = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], lp = rnd() * TAU;
  g.tube(pts, (u, th) => {
    const prof = Math.pow(Math.max(Math.sin(Math.PI * Math.min(Math.max(u, .004), .996)), 0), .55) * (1 + lobe * Math.cos(u * TAU * 1.5 + lp));
    const lump = .17 * Math.sin(th * 2 + u * 7 + f[0]) + .13 * Math.sin(th * 3 - u * 11 + f[1]) + .08 * Math.sin(th * 5 + u * 17 + f[2]) + .06 * Math.sin(th * 4 - u * 23 + f[3]);
    return r0 * prof * (1 + lump);
  }, seg, 1, true);
  return g.build();
}

// RNA：單股骨架 + 鹼基；plan 由 ['ss', 核苷酸數] 與 ['hp', 配對數, 環長] 組成
function rnaGeo(seed, plan, confine = 0, curl = .42) {
  const rnd = makeRng(seed), g = new Geo(), STEP = .0125, RAD = .019, RISE = .0078, TW = .571;
  const nts = [], pairs = [];
  const pos = new V3(), dir = rnd.dir(), tmp = new V3(), ref = rnd.dir();
  let tw = 0;
  const perp = (d, ang, out) => { ref.addScaledVector(d, -ref.dot(d)); if (ref.lengthSq() < 1e-4) rnd.dir(ref).addScaledVector(d, -ref.dot(d)); ref.normalize(); tmp.crossVectors(d, ref); return out.copy(ref).multiplyScalar(Math.cos(ang)).addScaledVector(tmp, Math.sin(ang)); };
  for (const seg of plan) {
    if (seg[0] === 'ss') {
      for (let k = 0; k < seg[1]; k++) {
        dir.add(rnd.dir(tmp).multiplyScalar(curl)).normalize();
        if (confine && pos.length() > confine * .55) dir.addScaledVector(pos, -.6 / confine).normalize();
        pos.addScaledVector(dir, STEP); tw += .62;
        nts.push({ p: pos.clone(), b: perp(dir, tw, new V3()).clone() });
      }
    } else {
      const bp = seg[1], loop = seg[2], u = dir.clone(), ax = perp(dir, rnd() * TAU, new V3()).clone(), v = new V3().crossVectors(ax, u);
      const c0 = pos.clone().addScaledVector(u, RAD);
      const P = (i, an) => c0.clone().addScaledVector(ax, (i + .5) * RISE).addScaledVector(u, RAD * Math.cos(an)).addScaledVector(v, RAD * Math.sin(an));
      const s1 = [], s2 = [];
      for (let i = 0; i < bp; i++) { s1.push(P(i, Math.PI + i * TW)); s2.push(P(i, Math.PI + i * TW + 2.5)); }
      const base = nts.length;
      for (let i = 0; i < bp; i++) nts.push({ p: s1[i], b: null });
      const a1 = Math.PI + (bp - 1) * TW, a2 = a1 + 2.5 - TAU; // 環從另一側繞回來
      for (let k = 1; k <= loop; k++) { const s = k / (loop + 1), an = a1 + (a2 - a1) * s, q = P(bp - 1 + 2.2 * Math.sin(Math.PI * s), an); q.addScaledVector(u, RAD * .25 * Math.cos(an) * Math.sin(Math.PI * s)).addScaledVector(v, RAD * .25 * Math.sin(an) * Math.sin(Math.PI * s)); nts.push({ p: q, b: new V3().copy(u).multiplyScalar(Math.cos(an)).addScaledVector(v, Math.sin(an)) }); }
      for (let i = bp - 1; i >= 0; i--) nts.push({ p: s2[i], b: null });
      for (let i = 0; i < bp; i++) pairs.push([s1[i], s2[i]]);
      pos.copy(s2[0]); dir.copy(u).addScaledVector(v, .5).addScaledVector(ax, -.3).normalize();
      void base;
    }
  }
  const c = new V3(); for (const q of nts) c.add(q.p); c.multiplyScalar(1 / nts.length);
  for (const q of nts) q.p.sub(c); for (const [x, y] of pairs) { /* s1/s2 與 nts 共用同一批向量，已一起平移 */ void x; void y; }
  const back = spline(nts.map(q => q.p), nts.length * 2);
  g.tube(back, .0052, 5, 1);
  for (const q of nts) if (q.b) g.tube([q.p.clone().addScaledVector(q.b, .003), q.p.clone().addScaledVector(q.b, .0135)], .0031, 4, 1.25);
  for (const [x, y] of pairs) g.tube([x, y], .0029, 4, 1.25, false);
  let rad = 0; for (const q of nts) rad = Math.max(rad, q.p.length());
  const geo = g.build(); geo.userData.radius = rad;
  return geo;
}

// ───────────────────────── 材質 ─────────────────────────
const lipidVert = /* glsl */`
${GLSL_MEMBRANE}
attribute vec3 aDir;
attribute vec4 aRnd;
attribute vec3 aInfo;   // x 內外葉(+1/-1)、y 頭大小、z 脂質種類
uniform float uRmid, uHeadOff, uHeadR, uTailLen, uJit;
uniform vec3 uHeadCol, uHeadCol2, uTailCol;
varying vec2 vUV; varying float vPart; varying vec3 vCv; varying float vHr; varying vec3 vNm; varying vec3 vSide; varying vec3 vPv;
varying vec3 vCol; varying float vFilm; varying float vEdge;
void main() {
  vec3 d = aDir; float leaf = aInfo.x;
  float edge = uCut.w - dot(d, uCut.xyz);
  vec4 md = membraneDisp(d);
  vec3 T, B; tangentFrame(d, T, B);
  float sp = aRnd.w * 6.2832; vec3 T2 = T * cos(sp) + B * sin(sp), B2 = cross(d, T2);
  float t1 = uTime * (1.9 + aRnd.x * 2.6) + aRnd.y * 50., t2 = uTime * (1.5 + aRnd.z * 2.9) + aRnd.x * 80.;
  float j1 = sin(t1) + .6 * sin(t1 * 2.7 + aRnd.z * 9.), j2 = sin(t2) + .6 * sin(t2 * 2.3 + aRnd.y * 7.), j3 = sin(t1 * 1.3 + t2 * .7);
  float hr = uHeadR * aInfo.y;
  vec3 c = d * (uRmid + leaf * uHeadOff + md.w + j3 * .22 * uHeadR * uJit) + md.xyz + (T2 * j1 + B2 * j2) * (.2 * uHeadR * uJit);
  vec3 ax = normalize(-leaf * d + (T2 * j2 - B2 * j1) * (.09 * uJit));
  vec4 cv = modelViewMatrix * vec4(c, 1.);
  vec3 nm = normalize(normalMatrix * (d - mGrad)) * leaf;
  bool cull = edge < 0. || (dot(nm, normalize(-cv.xyz)) < -.22 && edge > .1);
  vec3 pv;
  vSide = vec3(1., 0., 0.);
  if (position.z < .5) {
    pv = cv.xyz + vec3(position.xy * hr, 0.);
    float kind = step(.8, aInfo.z);
    vCol = mix(uHeadCol, uHeadCol2, kind) * (.88 + .24 * aRnd.x) * (leaf > 0. ? vec3(1.) : vec3(1.0, .9, .84));
  } else {
    float s = position.z < 1.5 ? 1. : -1., y = position.y;
    vec3 p0 = c + ax * (hr * .7 + y * uTailLen) + T2 * (s * hr * .42) + B2 * (max(-s, 0.) * hr * .5 * sin(y * 3.1416));
    vec4 p0v = modelViewMatrix * vec4(p0, 1.);
    vec3 axv = normalize(mat3(modelViewMatrix) * ax);
    vec3 side = normalize(cross(axv, p0v.xyz) + vec3(1e-5, 0., 0.));
    pv = p0v.xyz + side * (position.x * hr * mix(.36, .2, y));
    vSide = side;
    vCol = uTailCol * (.75 + .5 * aRnd.y) * mix(1., .6, y);
  }
  vUV = position.xy; vPart = position.z; vCv = cv.xyz; vHr = hr; vNm = nm; vPv = pv; vEdge = edge;
  vFilm = 400. + 150. * mWave(d * 1.4 + 3.1, uTime * .6) - 110. * d.y;
  gl_Position = cull ? vec4(2., 2., 2., 1.) : projectionMatrix * vec4(pv, 1.);
}`;

const lipidFrag = /* glsl */`
uniform mat4 projectionMatrix;
uniform float uBeadAo;
${GLSL_SHADE}
varying vec2 vUV; varying float vPart; varying vec3 vCv; varying float vHr; varying vec3 vNm; varying vec3 vSide; varying vec3 vPv;
varying vec3 vCol; varying float vFilm; varying float vEdge;
void main() {
  vec3 Nm = normalize(vNm);
  float ek = smoothstep(.0, .09, vEdge);   // 0 = 緊貼切面
  vec3 col; vec3 pv;
  if (vPart < .5) {
    float z = sqrt(max(1. - dot(vUV, vUV), 0.));
    vec3 n = vec3(vUV, z);
    pv = vCv + n * vHr;
    gl_FragDepth = ((projectionMatrix[2][2] * pv.z + projectionMatrix[3][2]) / -pv.z) * .5 + .5;
    vec3 V = normalize(-pv);
    vec3 N = normalize(mix(n, Nm, .45 * ek));
    float ao = mix(1., smoothstep(-.4, .7, dot(n, Nm)), uBeadAo * ek);
    col = pearlShade(N, normalize(mix(n, Nm, ek)), V, vFilm, vCol, ek) * ao;
  } else {
    float x = clamp(vUV.x, -1., 1.);
    vec3 n = normalize(vSide * x + vec3(0., 0., sqrt(max(1. - x * x, 0.)) + .001));
    pv = vPv;
    gl_FragDepth = gl_FragCoord.z;
    float dif = pow(clamp(dot(n, L_KEY) * .5 + .5, 0., 1.), 1.5);
    col = vCol * (.1 + dif * .8) + vCol * pow(1. - abs(n.z), 2.) * .25;
  }
  gl_FragColor = vec4(applyFog(col, -pv.z), 1.);
}`;

const protVert = /* glsl */`
${GLSL_MEMBRANE}
attribute vec3 aDir;
attribute vec4 aRnd;
attribute float aTint;
uniform float uRmid, uProt, uJit;
varying vec3 vN; varying vec3 vPv; varying float vTint; varying float vY;
void main() {
  vec4 md = membraneDisp(aDir);
  vec3 T, B; tangentFrame(aDir, T, B);
  vec3 anchor = aDir * uRmid;
  vec3 rel = (instanceMatrix * vec4(position, 1.)).xyz - anchor;
  vec3 nr = mat3(instanceMatrix) * normal;
  vec3 rock = (T * sin(uTime * (.7 + aRnd.x) + aRnd.y * 30.) + B * sin(uTime * (.6 + aRnd.z) + aRnd.w * 30.)) * (.06 * uJit);
  rel += cross(rock, rel); nr += cross(rock, nr);
  vec3 p = anchor + rel * uProt + aDir * md.w + md.xyz;
  vec4 pv = modelViewMatrix * vec4(p, 1.);
  vN = normalMatrix * nr; vPv = pv.xyz; vTint = aTint; vY = position.y;
  gl_Position = dot(aDir, uCut.xyz) > uCut.w || uProt < .01 ? vec4(2., 2., 2., 1.) : projectionMatrix * pv;
}`;
const protFrag = /* glsl */`
uniform vec3 uColor, uGly;
${GLSL_SHADE}
varying vec3 vN; varying vec3 vPv; varying float vTint; varying float vY;
void main() {
  vec3 V = normalize(-vPv), N = normalize(vN); if (dot(N, V) < 0.) N = -N;
  vec3 alb = vTint < 0. ? uGly : uColor * vTint;
  float emb = mix(.72, 1., smoothstep(.035, .065, abs(vY)));   // 埋在膜裡的那段稍暗
  vec3 col = matteShade(N, V, alb, .04) * emb;
  gl_FragColor = vec4(applyFog(col, -vPv.z), 1.);
}`;

const cargoVert = /* glsl */`
uniform float uTime, uDrift;
uniform vec4 uCutC;     // 貨物裁切平面：dot(pos, n) > w 的收掉
attribute vec4 aRnd;
attribute vec3 aCol;
attribute float aTint;
varying vec3 vN; varying vec3 vPv; varying vec3 vCol; varying float vGlow; varying vec3 vPo;
void main() {
  vPo = position + aRnd.xyz * 7.;
  vec3 home = instanceMatrix[3].xyz;
  vec3 dr = vec3(sin(uTime * (.21 + .2 * aRnd.x) + aRnd.y * 40.), sin(uTime * (.17 + .2 * aRnd.y) + aRnd.z * 40.), sin(uTime * (.19 + .2 * aRnd.z) + aRnd.w * 40.)) * uDrift;
  float k = smoothstep(0., .045, uCutC.w - dot(home, uCutC.xyz));
  vec3 lp = mat3(instanceMatrix) * position, ln = mat3(instanceMatrix) * normal;
  // 緩慢翻滾
  vec3 ax = normalize(aRnd.xyz - .5 + vec3(1e-3)); float an = uTime * (.05 + .09 * aRnd.w) * (aRnd.x > .5 ? 1. : -1.) * step(.001, uDrift);
  float ca = cos(an), sa = sin(an);
  lp = lp * ca + cross(ax, lp) * sa + ax * dot(ax, lp) * (1. - ca);
  ln = ln * ca + cross(ax, ln) * sa + ax * dot(ax, ln) * (1. - ca);
  vec4 pv = modelViewMatrix * vec4(home + dr + lp * k, 1.);
  // 越深入切面下方越暗：擁擠的腔內才有層次，不會一整面一樣亮
  float deep = max(uCutC.w - dot(home, uCutC.xyz) - .07, 0.);
  vN = normalMatrix * ln; vPv = pv.xyz; vCol = aCol * aTint * exp(-deep * 6.5); vGlow = aRnd.w;
  gl_Position = k < .01 ? vec4(2., 2., 2., 1.) : projectionMatrix * pv;
}`;
const cargoFrag = /* glsl */`
uniform float uGlow, uBump;
${GLSL_SHADE}
varying vec3 vN; varying vec3 vPv; varying vec3 vCol; varying float vGlow; varying vec3 vPo;
// 分子表面的原子級起伏（週期約 1 nm）；只在夠近、一個起伏大於數個像素時才出現
float lump(vec3 p) {
  vec3 q = p * 330.;
  float a = sin(q.x + 1.3 * sin(q.y * .57)) * sin(q.y + 1.3 * sin(q.z * .61)) * sin(q.z + 1.3 * sin(q.x * .53));
  vec3 r = p * 610. + 2.1;
  return a * .7 + sin(r.x) * sin(r.y) * sin(r.z) * .3;
}
void main() {
  vec3 V = normalize(-vPv), N = normalize(vN); if (dot(N, V) < 0.) N = -N;
  float cav = 1., term = 1.;
  if (uBump > 0.) {
    float h = lump(vPo);
    float bk = uBump * (1. - smoothstep(.45, 1.5, length(fwidth(vPo)) * 330.));
    vec3 dpx = dFdx(vPv), dpy = dFdy(vPv);
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
    float det = dot(dpx, r1);
    vec3 g = (dFdx(h) * r1 + dFdy(h) * r2) * (det < 0. ? -1. : 1.) / max(abs(det), 1e-9);
    N = normalize(N - clamp(g * .0022, -2., 2.) * bk);
    cav = mix(1., .6 + .4 * smoothstep(-.8, .6, h), bk);
    term = mix(.5, 1.1, smoothstep(.2, .95, dot(N, L_KEY) * .5 + .5));
  }
  vec3 col = matteShade(N, V, vCol, uGlow) * cav * term;
  gl_FragColor = vec4(applyFog(col, -vPv.z), 1.);
}`;

const shellVert = /* glsl */`
${GLSL_MEMBRANE}
uniform float uRad;
varying vec3 vDir; varying vec3 vN; varying vec3 vPv; varying float vFilm;
void main() {
  vec3 d = normalize(position);
  vec4 md = membraneDisp(d);
  vec4 pv = modelViewMatrix * vec4(d * (uRad + md.w) + md.xyz * .5, 1.);
  vDir = d; vN = normalMatrix * (d - mGrad); vPv = pv.xyz;
  vFilm = 400. + 150. * mWave(d * 1.4 + 3.1, uTime * .6) - 110. * d.y;
  gl_Position = projectionMatrix * pv;
}`;
// 膜中央的疏水薄層：擋住看穿，從縫隙看進去是暗的尾巴色
const coreFrag = /* glsl */`
uniform vec4 uCut;
${GLSL_SHADE}
varying vec3 vDir; varying vec3 vN; varying vec3 vPv; varying float vFilm;
void main() {
  if (dot(vDir, uCut.xyz) > uCut.w - .075) discard; // 退到主角蛋白後方，才不會把跨膜螺旋切斷
  vec3 V = normalize(-vPv), N = normalize(vN); float out_ = gl_FrontFacing ? 1. : 0.; if (dot(N, V) < 0.) N = -N;
  float ndv = clamp(dot(N, V), 0., 1.);
  float dif = pow(clamp(dot(N, L_KEY) * .5 + .5, 0., 1.), 1.6);
  vec3 col = vec3(.30, .26, .20) * (.25 + dif * .8) + C_BACK * pow(1. - ndv, 2.) * .12 * out_;
  gl_FragColor = vec4(applyFog(col, -vPv.z), 1.);
}`;
// 皂膜光澤（加色）＋遠距時取代脂質顆粒的平滑珍珠
const skinFrag = /* glsl */`
uniform vec4 uCut;
uniform float uPearl, uSheen;
uniform vec3 uHeadCol;
${GLSL_SHADE}
varying vec3 vDir; varying vec3 vN; varying vec3 vPv; varying float vFilm;
void main() {
  if (dot(vDir, uCut.xyz) > uCut.w) discard;
  vec3 V = normalize(-vPv), N = normalize(vN);
  float ndv = clamp(dot(N, V), 0., 1.);
  vec3 tf = thinFilm(ndv, vFilm + 60.);
  vec3 H = normalize(L_KEY + V), H2 = normalize(L_FILL + V);
  vec3 sheen = tf * pow(1. - ndv, 2.4) * .34
             + C_KEY * (pow(max(dot(N, H), 0.), 260.) * .55 + pow(max(dot(N, H), 0.), 30.) * .05)
             + C_FILL * pow(max(dot(N, H2), 0.), 90.) * .35;
  vec3 pearl = pearlShade(N, N, V, vFilm, uHeadCol, 1.);
  vec3 col = pearl * uPearl + sheen * uSheen;
  gl_FragColor = vec4(applyFog(col, -vPv.z) * 1., uPearl);
}`;

// ───────────────────────── 囊泡 ─────────────────────────
export function createVesicle({ tier = 'high', seed = 11, cutN = new V3(-.3, .42, .86), cutH = .04, cargoHero = null } = {}) {
  const low = tier === 'low', rnd = makeRng(seed);
  const RMID = .95, n = cutN.clone().normalize();
  const rho = new V3(0, 1, 0).addScaledVector(n, -n.y).normalize();       // 切環最高點方向：剖面特寫時胞外朝上、腔內朝下
  const tau = new V3().crossVectors(n, rho).normalize();
  const group = new THREE.Group();
  const U = {
    uTime: { value: 0 }, uWob: { value: 1 }, uJit: { value: 1 },
    uHit: { value: new THREE.Vector4(0, 0, 1, 0) },
    uRip: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, -1)) },
    uCut: { value: new THREE.Vector4(n.x, n.y, n.z, 1.05) },
    uCutC: { value: new THREE.Vector4(n.x, n.y, n.z, 1.05) },
    uFog: { value: new THREE.Vector4(.02, .024, .034, 0) }, uFogStart: { value: 0 },
    uRmid: { value: RMID }, uProt: { value: 1 }, uPearl: { value: 0 }, uSheen: { value: 1 },
    uDrift: { value: .012 },
  };
  let tris = 0;

  // ── 蛋白分佈：成群（tetraspanin-enriched microdomain）
  const ringDir = (ang, drop) => { const s = cutH - drop, c = Math.sqrt(1 - s * s); return rho.clone().multiplyScalar(Math.cos(ang) * c).addScaledVector(tau, Math.sin(ang) * c).addScaledVector(n, s); };
  const prot = [];
  const heroAng = [.15, 0, -.15];   // +tau 在畫面左：由左到右 CD9、CD63、CD81
  heroAng.forEach((a, k) => prot.push({ dir: ringDir(a, .027), kind: k, hero: true }));
  const tooClose = (d, min) => prot.some(q => q.dir.distanceTo(d) < min);
  const heroZone = d => d.distanceTo(rho) < .44 && d.dot(n) > cutH - .075;
  const tmp = new V3(), tmp2 = new V3();
  const scatter = (center, sigma) => { rnd.dir(tmp).multiplyScalar(sigma * Math.abs(rnd.gauss())); return tmp.addScaledVector(center, -tmp.dot(center)).add(center).normalize().clone(); };
  // 英雄後方的同群成員（在保留的外表面上）
  for (let k = 0; k < (low ? 3 : 7); k++) for (let tr = 0; tr < 30; tr++) { const d = ringDir(rnd.range(-.34, .34), rnd.range(.1, .3)); if (tooClose(d, .066)) continue; prot.push({ dir: d, kind: Math.floor(rnd() * 3) }); break; }
  const centers = [];
  for (let tr = 0; tr < 400 && centers.length < (low ? 6 : 13); tr++) { const d = rnd.dir(); if (centers.some(c => c.distanceTo(d) < .55) || d.distanceTo(rho) < .5) continue; centers.push(d); }
  for (const c of centers) {
    const dom = Math.floor(rnd() * 3), k = low ? 3 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 7);
    for (let m = 0; m < k; m++) for (let tr = 0; tr < 24; tr++) { const d = scatter(c, .12); if (tooClose(d, .064) || heroZone(d)) continue; prot.push({ dir: d, kind: rnd() < .62 ? dom : Math.floor(rnd() * 3) }); break; }
  }
  for (let k = 0; k < (low ? 4 : 14); k++) for (let tr = 0; tr < 24; tr++) { const d = rnd.dir(); if (tooClose(d, .09) || heroZone(d)) continue; prot.push({ dir: d, kind: Math.floor(rnd() * 3) }); break; }
  const nTsp = prot.length;
  for (let k = 0; k < (low ? 3 : 7); k++) for (let tr = 0; tr < 40; tr++) { const d = rnd.dir(); if (tooClose(d, .13) || d.distanceTo(rho) < .55) continue; prot.push({ dir: d, kind: 3 }); break; }
  const nProt = prot.length;
  const gly = [];
  for (let k = 0; k < (low ? 20 : 76); k++) for (let tr = 0; tr < 20; tr++) {
    const d = k % 2 ? scatter(prot[Math.floor(rnd() * nTsp)].dir, .1) : rnd.dir();
    if (tooClose(d, .042) || heroZone(d) || gly.some(q => q.distanceTo(d) < .03)) continue; gly.push(d); break;
  }

  // ── 脂質：費波那契球面 + 抖動，蛋白腳下與英雄正前方留空
  const nOut0 = low ? 10000 : 27000, spacing = Math.sqrt(1.1547 * 4 * Math.PI / nOut0);
  const headR = .57 * spacing, headOff = .05 - headR, tailLen = Math.max(headOff - .7 * headR + .006, .004);
  const rIn = (RMID - headOff) / (RMID + headOff), nIn0 = Math.round(nOut0 * rIn * rIn);
  const aDir = [], aRnd = [], aInfo = [];
  const GA = Math.PI * (3 - Math.sqrt(5));
  const pd = prot.map(q => [q.dir.x, q.dir.y, q.dir.z, q.kind === 3 ? .024 : .0285, q.hero ? 1 : 0]);
  const heroN = prot.filter(q => q.hero).map(q => q.dir.dot(n));
  const heroT = prot.filter(q => q.hero).map(q => q.dir.dot(tau));
  let nOuter = 0;
  for (let leaf = 1; leaf >= -1; leaf -= 2) {
    const N = leaf > 0 ? nOut0 : nIn0, jit = .2 * spacing * (leaf > 0 ? 1 : 1 / rIn);
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), ph = i * GA + (leaf > 0 ? 0 : 1.3);
      tmp.set(r * Math.cos(ph), y, r * Math.sin(ph)); rnd.dir(tmp2); tmp.addScaledVector(tmp2, jit).normalize();
      let ok = true, near = 1;
      for (let k = 0; k < pd.length; k++) { const q = pd[k], dx = tmp.x - q[0], dy = tmp.y - q[1], dz = tmp.z - q[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < q[3] * q[3]) { ok = false; break; } if (d2 < near) near = d2; }
      if (!ok) continue;
      // 英雄正前方（往切面那一側）清空，才看得到螺旋束穿膜
      const dn = tmp.dot(n), dtau = tmp.dot(tau);
      if (tmp.dot(rho) > .8) { for (let k = 0; k < heroN.length; k++) if (dn > heroN[k] - .006 && dn < cutH + .004 && Math.abs(dtau - heroT[k]) < .037) ok = false; }
      if (!ok) continue;
      // 脂質種類：成片分佈（筏區），靠近四次跨膜蛋白處更多
      const raft = .5 + .5 * Math.sin(tmp.x * 5.1 + tmp.y * 3.3) * Math.sin(tmp.y * 4.7 - tmp.z * 5.9);
      const sp = rnd() * .72 + raft * .2 + (near < .014 ? .16 : 0);
      aDir.push(tmp.x, tmp.y, tmp.z); aRnd.push(rnd(), rnd(), rnd(), rnd());
      aInfo.push(leaf, sp > .8 ? rnd.range(.7, .82) : rnd.range(.9, 1.1), sp);
      if (leaf > 0) nOuter++;
    }
  }
  const nLip = aDir.length / 3;
  {
    const pos = [], idx = [];
    for (let k = 0; k < 16; k++) pos.push(Math.cos(k / 16 * TAU), Math.sin(k / 16 * TAU), 0);
    for (let k = 1; k < 15; k++) idx.push(0, k, k + 1);
    for (const part of [1, 2]) { const b = pos.length / 3; for (const y of [0, .5, 1]) pos.push(-1, y, part, 1, y, part); for (let s = 0; s < 2; s++) { const a = b + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(aDir), 3));
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array(aRnd), 4));
    g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(aInfo), 3));
    g.instanceCount = nLip;
    Object.assign(U, {
      uHeadOff: { value: headOff }, uHeadR: { value: headR }, uTailLen: { value: tailLen }, uBeadAo: { value: .7 },
      uHeadCol: { value: new THREE.Color(.80, .86, .80) }, uHeadCol2: { value: new THREE.Color(.90, .78, .58) }, uTailCol: { value: new THREE.Color(.74, .66, .48) },
    });
    var lipids = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: lipidVert, fragmentShader: lipidFrag, side: THREE.DoubleSide }));
    lipids.frustumCulled = false; group.add(lipids);
  }

  // ── 中央薄層與皂膜
  const sph = new THREE.SphereGeometry(1, low ? 72 : 128, low ? 48 : 84);
  const core = new THREE.Mesh(sph, new THREE.ShaderMaterial({ uniforms: { ...U, uRad: { value: RMID } }, vertexShader: shellVert, fragmentShader: coreFrag, side: THREE.DoubleSide }));
  core.frustumCulled = false; core.renderOrder = -1; group.add(core);
  const skin = new THREE.Mesh(sph, new THREE.ShaderMaterial({
    uniforms: { ...U, uRad: { value: 1.006 } }, vertexShader: shellVert, fragmentShader: skinFrag,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  }));
  skin.frustumCulled = false; skin.renderOrder = 5; group.add(skin);
  tris += sph.index.count / 3 * 2;

  // ── 膜蛋白
  const M = new THREE.Matrix4(), X = new V3(), Z = new V3();
  const frame = (d, zHint, spin) => {
    Z.copy(zHint).addScaledVector(d, -zHint.dot(d)); if (Z.lengthSq() < 1e-5) Z.set(d.y, d.z, d.x).addScaledVector(d, -Z.dot(d)); Z.normalize();
    X.crossVectors(d, Z); Z.multiplyScalar(Math.cos(spin)).addScaledVector(X, Math.sin(spin)); X.crossVectors(d, Z);
    return M.makeBasis(X, d, Z).setPosition(d.x * RMID, d.y * RMID, d.z * RMID);
  };
  const protMat = col => new THREE.ShaderMaterial({ uniforms: { ...U, uColor: { value: col }, uGly: { value: new THREE.Color(.62, .6, .55) } }, vertexShader: protVert, fragmentShader: protFrag, side: THREE.DoubleSide });
  const addInst = (geo, list, mat, mk) => {
    if (!list.length) return null;
    const g = geo.clone(), m = new THREE.InstancedMesh(g, mat, list.length), dirs = new Float32Array(list.length * 3), rr = new Float32Array(list.length * 4);
    list.forEach((q, i) => { const d = q.dir || q; mk(q, d); m.setMatrixAt(i, M); dirs.set([d.x, d.y, d.z], i * 3); rr.set([rnd(), rnd(), rnd(), rnd()], i * 4); });
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dirs, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rr, 4));
    m.frustumCulled = false; group.add(m); tris += g.index.count / 3 * list.length;
    return m;
  };
  const protCols = [COLORS.cd9, COLORS.cd63, COLORS.cd81].map(c => c.clone());
  const heroes = {};
  const prots = [0, 1, 2].map(kind => addInst(tetraspaninGeo(kind, 31 + kind), prot.filter(q => q.kind === kind), protMat(protCols[kind]),
    (q, d) => { if (q.hero) { frame(d, n, .62); heroes[['cd9', 'cd63', 'cd81'][kind]] = new V3(0, kind === 1 ? .125 : .112, 0).applyMatrix4(M); } else frame(d, tmp.set(.3, .5, .8), rnd() * TAU); }));
  prots.push(addInst(integrinGeo(77), prot.filter(q => q.kind === 3), protMat(new THREE.Color(.5, .5, .47)), (q, d) => frame(d, tmp.set(.3, .5, .8), rnd() * TAU)));
  prots.push(addInst(glycanGeo(78), gly, protMat(new THREE.Color(.6, .58, .53)), (q, d) => frame(d, tmp.set(.3, .5, .8), rnd() * TAU)));
  heroes.bilayer = ringDir(.075, .012).multiplyScalar(RMID);

  // ── 腔內貨物：先排好位置（互相推擠到不重疊），著色器裡再緩慢漂動
  const RL = .862, items = [];
  const blobKinds = [
    { geo: blobGeo(41, { len: .21, r0: .042, bend: .55, lobe: .16, seg: 16, rings: 26 }), r: .082, col: new THREE.Color(.78, .30, .24), w: .14 },   // ALIX：長、彎
    { geo: blobGeo(42, { len: .125, r0: .047, bend: .15, lobe: .24, seg: 16, rings: 20 }), r: .06, col: new THREE.Color(.84, .40, .29), w: .2 },    // TSG101
    { geo: blobGeo(43, { len: .105, r0: .05, seg: 14, rings: 16 }), r: .052, col: new THREE.Color(.50, .37, .40), w: .28 },
    { geo: blobGeo(44, { len: .13, r0: .04, bend: .3, lobe: .1, seg: 14, rings: 16 }), r: .055, col: new THREE.Color(.40, .40, .47), w: .2 },
    { geo: blobGeo(45, { len: .085, r0: .041, seg: 12, rings: 14 }), r: .043, col: new THREE.Color(.58, .45, .36), w: .18 },
  ];
  const rnaKinds = [
    { geo: rnaGeo(51, [['ss', 22]], 0, .24), n: low ? 8 : 30, pack: .6 },
    { geo: rnaGeo(52, [['ss', 23]], 0, .3), n: low ? 6 : 22, pack: .6 },
    { geo: rnaGeo(53, [['ss', 6], ['hp', 10, 6], ['ss', 5]], 0, .3), n: low ? 3 : 10, pack: .7 },
    { geo: rnaGeo(54, [['ss', 5], ['hp', 8, 5], ['ss', 9], ['hp', 6, 4], ['ss', 4]], .1, .34), n: low ? 3 : 9, pack: .7 },
    { geo: rnaGeo(55, [['ss', 8], ['hp', 7, 5], ['ss', 11], ['hp', 9, 6], ['ss', 12], ['hp', 6, 4], ['ss', 13], ['hp', 8, 5], ['ss', 7]], .13, .4), n: low ? 2 : 6, pack: .62 },
    { geo: rnaGeo(56, [['ss', 10], ['hp', 9, 6], ['ss', 14], ['hp', 7, 4], ['ss', 16], ['hp', 10, 7], ['ss', 9]], .12, .4), n: low ? 2 : 6, pack: .62 },
  ];
  const cargoHeroes = {};
  if (cargoHero) {
    items.push({ p: cargoHero.rna.clone(), r: rnaKinds[4].geo.userData.radius * .8, fixed: true, rna: 4, hero: 'rna' });
    items.push({ p: cargoHero.blob.clone(), r: blobKinds[1].r, fixed: true, blob: 1, hero: 'cargo' });
    if (cargoHero.blob2) items.push({ p: cargoHero.blob2.clone(), r: blobKinds[0].r, fixed: true, blob: 0 });
  }
  rnaKinds.forEach((k, ki) => { for (let i = 0; i < k.n; i++) items.push({ r: k.geo.userData.radius * k.pack, rna: ki }); });
  const nBlob = low ? 150 : 560;
  for (let i = 0; i < nBlob; i++) { let u = rnd(), ki = 0; while (ki < blobKinds.length - 1 && u > blobKinds[ki].w) { u -= blobKinds[ki].w; ki++; } items.push({ r: blobKinds[ki].r, blob: ki }); }
  for (const it of items) if (!it.p) it.p = rnd.dir().multiplyScalar((RL - it.r) * Math.cbrt(rnd()));
  for (let pass = 0; pass < 70; pass++) {
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], Bq = items[j], dx = Bq.p.x - A.p.x, dy = Bq.p.y - A.p.y, dz = Bq.p.z - A.p.z, min = (A.r + Bq.r) * .9, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= min * min || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), push = (min - d) / d * .5, wa = A.fixed ? 0 : Bq.fixed ? 2 : 1, wb = Bq.fixed ? 0 : A.fixed ? 2 : 1;
      A.p.x -= dx * push * wa; A.p.y -= dy * push * wa; A.p.z -= dz * push * wa; Bq.p.x += dx * push * wb; Bq.p.y += dy * push * wb; Bq.p.z += dz * push * wb;
    }
    for (const it of items) { if (it.fixed) continue; const l = it.p.length(), m = RL - it.r; if (l > m) it.p.multiplyScalar(m / l); }
  }
  const Q = new THREE.Quaternion(), S = new V3(), E = new THREE.Euler();
  const cargoMat = (glow, bump = 0) => new THREE.ShaderMaterial({ uniforms: { ...U, uGlow: { value: glow }, uBump: { value: bump } }, vertexShader: cargoVert, fragmentShader: cargoFrag, side: THREE.DoubleSide });
  const cargo = [];
  const addCargo = (geo, list, mat, colFn) => {
    if (!list.length) return;
    const g = geo.clone(), m = new THREE.InstancedMesh(g, mat, list.length), rr = new Float32Array(list.length * 4), cc = new Float32Array(list.length * 3);
    list.forEach((it, i) => {
      const r4 = [rnd(), rnd(), rnd(), rnd()], sc = it.fixed ? 1 : rnd.range(.88, 1.12);
      E.set(rnd() * TAU, rnd() * TAU, rnd() * TAU); if (it.hero === 'rna') E.set(.4, .3, .2);
      M.compose(it.p, Q.setFromEuler(E), S.setScalar(sc)); m.setMatrixAt(i, M); rr.set(r4, i * 4);
      const c = colFn(it); cc.set([c.r, c.g, c.b], i * 3);
      if (it.hero) cargoHeroes[it.hero] = { home: it.p.clone(), rnd: r4 };
    });
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rr, 4)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(cc, 3));
    m.frustumCulled = false; group.add(m); cargo.push(m); tris += g.index.count / 3 * list.length;
  };
  const cTmp = new THREE.Color();
  blobKinds.forEach((k, ki) => addCargo(k.geo, items.filter(it => it.blob === ki), cargoMat(ki < 2 ? .06 : 0, 1), () => { const v = rnd.range(.85, 1.12); return cTmp.copy(k.col).multiplyScalar(v); }));
  rnaKinds.forEach((k, ki) => addCargo(k.geo, items.filter(it => it.rna === ki), cargoMat(.42), () => cTmp.copy(COLORS.rna).multiplyScalar(rnd.range(.85, 1.1))));

  let open = true;
  const api = {
    group, uniforms: U, n, rho, tau, cutH, RMID, heroes, cargoHeroes, nLipids: nLip, nOuter, nProteins: nProt, nCargo: items.length,
    get tris() { return tris + (open ? nLip : nOuter) * 22; },
    // 關著的時候內葉與貨物完全被擋住，直接不畫
    setOpen(v) { if (v === open) return; open = v; lipids.geometry.instanceCount = v ? nLip : nOuter; for (const m of cargo) m.visible = v; },
    setDetail(v) { lipids.visible = v; for (const m of prots) if (m) m.visible = v; core.visible = v; },
    // 與著色器相同的環境起伏（給標註錨點用）
    wave(d, t) { return Math.sin(d.x * 2.3 + d.y * 1.7 + t * .41) * .42 + Math.sin(d.y * 3.1 - d.z * 2.6 + t * .33 + 1.7) * .30 + Math.sin(d.z * 4.3 + d.x * 3.4 - t * .52 + 4.1) * .18 + Math.sin(d.x * 6.1 - d.y * 5.3 + d.z * 4.7 + t * .77 + 2.3) * .10; },
    cargoPos(h, t, out) { const r = h.rnd, a = U.uDrift.value; return out.set(h.home.x + Math.sin(t * (.21 + .2 * r[0]) + r[1] * 40) * a, h.home.y + Math.sin(t * (.17 + .2 * r[1]) + r[2] * 40) * a, h.home.z + Math.sin(t * (.19 + .2 * r[2]) + r[3] * 40) * a); },
  };
  return api;
}

// ───────────────────────── 失焦粒子（背景囊泡、暗場微粒） ─────────────────────────
// 世界座標的圓片；依離焦距離放大並變柔，對焦時是一顆有受光的小珍珠。
export function createBokeh({ count, seed = 3, box = [45, 28, 40], center = [0, 0, -10], size = [.4, 1.4], keepOut = 3, gain = 1, tint = [.78, .86, .82] }) {
  const rnd = makeRng(seed), pos = new Float32Array(count * 3), rr = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let x, y, z, tr = 0;
    do { x = center[0] + rnd.range(-1, 1) * box[0]; y = center[1] + rnd.range(-1, 1) * box[1]; z = center[2] + rnd.range(-1, 1) * box[2]; } while (++tr < 20 && (Math.hypot(x, y, z) < keepOut || (Math.hypot(x, y) < keepOut * .8 && z > 0)));
    pos.set([x, y, z], i * 3);
    rr.set([size[0] * Math.pow(size[1] / size[0], Math.pow(rnd(), 1.6)), rnd(), rnd.range(.5, 1), rnd()], i * 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rr, 4));
  g.instanceCount = count;
  const uniforms = { uTime: { value: 0 }, uFocus: { value: 5 }, uAperture: { value: .2 }, uGain: { value: gain }, uTint: { value: new THREE.Color(...tint) }, uFlow: { value: new V3() }, uMaxCoc: { value: 3 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
uniform float uTime, uFocus, uAperture, uMaxCoc; uniform vec3 uFlow;
attribute vec3 aPos; attribute vec4 aRnd;
varying vec2 vUV; varying float vSoft; varying float vGain; varying float vSeed;
void main() {
  vec3 wp = aPos + uFlow + vec3(sin(uTime * (.11 + .1 * aRnd.y) + aRnd.w * 30.), sin(uTime * (.09 + .1 * aRnd.w) + aRnd.y * 30.), sin(uTime * .07 + aRnd.z * 30.)) * (.25 + aRnd.x * .4);
  vec4 mv = viewMatrix * vec4(wp, 1.);
  float dist = max(-mv.z, .001);
  float coc = min(uAperture * abs(dist - uFocus) / max(uFocus, .01), uMaxCoc) * (dist / max(uFocus, .01) < 1. ? dist / uFocus : 1.);
  float R = aRnd.x + coc;
  mv.xy += position.xy * R;
  vUV = position.xy; vSoft = coc / R; vGain = aRnd.z * clamp(aRnd.x * aRnd.x / (R * R), .02, 1.); vSeed = aRnd.w;
  gl_Position = mv.z > -.05 ? vec4(2., 2., 2., 1.) : projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
uniform float uGain; uniform vec3 uTint;
${GLSL_SHADE}
varying vec2 vUV; varying float vSoft; varying float vGain; varying float vSeed;
void main() {
  float r = length(vUV); if (r > 1.) discard;
  float inner = max(1. - 2. * vSoft, 0.);
  float a = 1. - smoothstep(inner, 1., r);
  float rs = min(r / max(1. - vSoft, .05), 1.);
  vec3 n = vec3(vUV / max(1. - vSoft, .05), sqrt(max(1. - rs * rs, 0.)));
  n = normalize(mix(n, vec3(0., 0., 1.), smoothstep(.15, .7, vSoft)));
  vec3 col = pearlShade(n, n, vec3(0., 0., 1.), 380. + 200. * vSeed, uTint, 1. - vSoft);
  col = mix(col, uTint * .34 * (.8 + .5 * r * r), smoothstep(.1, .6, vSoft));
  gl_FragColor = vec4(col * a * vGain * uGain, 1.);
}`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// 全螢幕底色：暗場，帶一點茄紫與深青
export function createBackdrop() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = { uA: { value: new THREE.Vector3(.3, .05, 1) }, uB: { value: new THREE.Vector3(-.5, -.6, 1) }, uAspect: { value: 1.78 }, uGain: { value: 1 },
    uColA: { value: new THREE.Color(.0085, .004, .013) }, uColB: { value: new THREE.Color(.0015, .0062, .0075) }, uBase: { value: new THREE.Color(.0022, .0028, .0038) } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vQ; void main(){ vQ = position.xy; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: /* glsl */`
uniform vec3 uA, uB, uColA, uColB, uBase; uniform float uAspect, uGain; varying vec2 vQ;
void main() {
  vec2 q = vQ * vec2(uAspect, 1.);
  vec2 a = q - uA.xy * vec2(uAspect, 1.), b = q - uB.xy * vec2(uAspect, 1.);
  vec3 c = uBase + uColA * exp(-dot(a, a) / (uA.z * uA.z)) * uGain + uColB * exp(-dot(b, b) / (uB.z * uB.z)) * uGain;
  gl_FragColor = vec4(c, 1.);
}`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = -100;
  return { mesh, uniforms };
}
