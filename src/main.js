// 引擎：捲動時間軸、章節排程、轉場、標註投影。章節合約見 CONTRACT.md。
import * as THREE from 'three';
import { createPost } from './post.js';
import { hooks as scrollHooks, rawScrollTo, nativeInner, classify } from './smooth-scroll.js';

const q = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;

// 章節在捲動軸上的範圍；mode 是「離開這一章」的轉場
export const TIMELINE = [
  { id: 'vesicle', a: 0.00, b: 0.28, mode: 0 },
  { id: 'origin',  a: 0.28, b: 0.50, mode: 1 },
  { id: 'purify',  a: 0.50, b: 0.80, mode: 2 },
  { id: 'vial',    a: 0.80, b: 1.00, mode: 0 },
];
const W = 0.02; // 轉場半寬

const touch = matchMedia('(pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tier = q.get('tier') || (touch || innerWidth < 700 ? 'low' : 'high');
const quality = { tier, msaa: tier === 'high' ? 4 : 0, maxDpr: tier === 'high' ? 1.75 : 1.4 };

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.info.autoReset = false;
const post = createPost(renderer, quality);

const ptr = { x: 0, y: 0, vx: 0, vy: 0, down: false, dragX: 0, dragY: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = 1 - e.clientY / innerHeight * 2;
  if (ptr.down) { ptr.dragX += e.movementX / innerWidth; ptr.dragY += e.movementY / innerHeight; }
}, { passive: true });
addEventListener('pointerdown', e => {
  ptr.down = e.target === canvas;
  ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = 1 - e.clientY / innerHeight * 2;
}, { passive: true });
for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, () => { ptr.down = false; });

function placeholder(id) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(id === 'vial' ? '#e8ebe7' : '#10161c');
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100); camera.position.z = 6;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshNormalMaterial({ wireframe: true })); scene.add(m);
  return { scene, camera, labels: [], update(p, t) { m.rotation.y = t * .3 + p * 4; }, theme: () => id === 'vial' ? 1 : 0, bloom: () => ({ strength: .3, radius: .6, threshold: .9 }) };
}

const chapters = {};
let dpr = 1, vw = 1, vh = 1, dprScale = 1;
function resize() {
  vw = Math.max(innerWidth, 2); vh = Math.max(innerHeight, 2); dpr = Math.min(devicePixelRatio || 1, quality.maxDpr) * dprScale;
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false); post.resize(vw, vh, dpr);
  for (const c of Object.values(chapters)) { c.camera.aspect = vw / vh; c.resize?.(vw, vh, dpr); c.camera.updateProjectionMatrix(); }
}

let target = 0, s = 0, t = 0, frozen = false, booted = false;
const track = document.getElementById('scroll'), siteEl = document.getElementById('site');
const maxScroll = () => Math.max(1, track.offsetHeight - innerHeight); // 3D 段落的捲動長度，後面接官網內容
addEventListener('scroll', () => {
  if (beat.active || (beat.lastSet >= 0 && Math.abs(scrollY - beat.lastSet) < 1.5)) return; // 自己設的捲動不反過來改 s
  beat.lastSet = -1;
  target = clamp(scrollY / maxScroll());
}, { passive: true });
export function seek(v, instant = false) {
  beatStop();
  scrollTo({ top: clamp(v) * maxScroll(), behavior: instant || reduced ? 'instant' : 'smooth' });
  if (instant) target = s = clamp(v);
}

// ─── 分幕播放：3D 區滾一格／一次手勢就從目前位置演到下一幕 ───
// 位置以捲動像素（浮點）表示，每幀由時間算出，直接驅動 s；最後一幕之後是官網內容區頂端。
export const BEATS = [0, 0.085, 0.125, 0.185, 0.30, 0.335, 0.375, 0.42, 0.465, 0.55, 0.60, 0.655, 0.715, 0.755, 0.85, 0.94];
const beatOn = !touch && !reduced && !q.has('nobeats');
const GESTURE_GAP = 160;
const beat = { active: false, y0: 0, y1: 0, T: 1, t0: 0, v0n: 0, m: 2, idx: 0, lastSet: -1, y: 0 };
const siteTop = () => siteEl.getBoundingClientRect().top + scrollY;
const beatYs = () => { const M = maxScroll(); return [...BEATS.map(b => b * M), siteTop()]; };
// 速度曲線 v(u) = v0n(1-u)^4 + K·u^m(1-u)^3，∫0..1 v = 1；m=2 起步柔（峰在 0.4、收尾長），m=1 用在播放中接續（加速度連續往上）
const BUMP = { 1: 1 / 20, 2: 1 / 60 };
function bumpInt(m, u) { return m === 1 ? u * u / 2 - u ** 3 + 0.75 * u ** 4 - u ** 5 / 5 : u ** 3 / 3 - 0.75 * u ** 4 + 0.6 * u ** 5 - u ** 6 / 6; }
function beatEval(now) {
  const u = clamp((now - beat.t0) / 1000 / beat.T), K = (1 - beat.v0n / 5) / BUMP[beat.m], w = 1 - u;
  const p = beat.v0n * (1 - w ** 5) / 5 + K * bumpInt(beat.m, u);
  const v = beat.v0n * w ** 4 + K * u ** beat.m * w ** 3;
  return { u, y: u >= 1 ? beat.y1 : beat.y0 + (beat.y1 - beat.y0) * p, vel: u >= 1 ? 0 : (beat.y1 - beat.y0) / beat.T * v };
}
function beatStop() {
  if (!beat.active) return;
  beat.active = false; beat.lastSet = -1;
  target = clamp(scrollY / maxScroll()); // s 從目前值平順接回原生捲動
}
function beatGo(dir) {
  const now = performance.now(), Ys = beatYs(), last = Ys.length - 1;
  let y = scrollY, vel = 0;
  if (beat.active) { const e = beatEval(now); y = e.y; vel = e.vel; }
  // 目前位置往 dir 方向的第一個幕點
  let ahead = dir > 0 ? Ys.findIndex(Y => Y > y + 1.5) : Ys.findLastIndex(Y => Y < y - 1.5);
  if (ahead < 0) return false;
  let idx = ahead;
  if (beat.active && Math.sign(beat.y1 - y) === dir) idx = Math.max(Math.min(beat.idx + dir, last), 0); // 同向：排下一幕
  if (dir > 0) idx = Math.min(idx, ahead + 1); else idx = Math.max(idx, ahead - 1); // 最多排 2 幕
  if (beat.active && idx === beat.idx) return true;
  const D = Ys[idx] - y, ds = Math.abs(D) / maxScroll();
  let T = clamp(1.25 + 11 * ds, 1.4, 2.8), v0n = vel * T / D;
  if (v0n > 3.5) { T = Math.max(0.7, 3.5 * D / vel); v0n = vel * T / D; }
  Object.assign(beat, { active: true, y0: y, y1: Ys[idx], T, t0: now, v0n, m: Math.abs(v0n) < 0.02 ? 2 : 1, idx, y });
  return true;
}
// 每幀呼叫（在渲染前）：算位置、設 s 與捲軸
function beatFrame(now) {
  if (!beat.active) return;
  if (beat.lastSet >= 0 && Math.abs(scrollY - beat.lastSet) > 3) { beatStop(); return; } // 捲軸拖曳等外力
  const e = beatEval(Math.max(now, beat.t0));
  beat.y = e.y;
  target = s = clamp(e.y / maxScroll());
  const r = Math.round(e.y); beat.lastSet = r; rawScrollTo(r);
  if (e.u >= 1) beat.active = false;
}
// 位置分區：3D 區（含內容區頂端往上）由幕點接手
function beatZone(dir) {
  const y = beat.active ? beat.y : scrollY, top = siteTop();
  if (y < top - 1.5) return true;
  return dir < 0 && y <= top + 1.5;
}
if (beatOn) {
  scrollHooks.floor = () => siteTop();
  scrollHooks.onExternal = beatStop;
  let lastWheel = 0, gDir = 0, gMode = '', owned = false;
  addEventListener('wheel', e => {
    if (!booted || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
    const dir = Math.sign(e.deltaY), now = performance.now(), gap = now - lastWheel;
    lastWheel = now;
    const fresh = gap > GESTURE_GAP || dir !== gDir;
    if (fresh) { gMode = classify(e); gDir = dir; owned = false; }
    if (nativeInner(e, e.deltaY)) return;
    if (!beatZone(dir)) { if (owned) e.preventDefault(); return; } // 播進內容區後，同一手勢的慣性尾巴擋掉
    e.preventDefault();
    if (fresh || gMode === 'mouse') { if (beatGo(dir)) owned = true; }
  }, { passive: false, capture: true });
  const INTERACTIVE = 'button, input, select, textarea, a[href], [contenteditable], [role="radio"], [role="option"], [role="slider"], [role="listbox"]';
  addEventListener('keydown', e => {
    if (!booted || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, dir = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey) ? 1 : k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey) ? -1 : 0;
    if (!dir) { if (k !== 'Shift' && k !== 'Tab') beatStop(); return; }
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    if (!beatZone(dir)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    beatGo(dir);
  }, true);
  addEventListener('mousedown', e => { if (e.clientX >= document.documentElement.clientWidth) beatStop(); }, true); // 捲軸
  addEventListener('touchstart', beatStop, { passive: true, capture: true });
  addEventListener('resize', beatStop);
}

const v3 = new THREE.Vector3();
function projectLabels(ch, p) {
  const out = [];
  for (const l of ch.labels || []) {
    const k = smooth(l.p[0], l.p[0] + .04, p) * (1 - smooth(l.p[1] - .04, l.p[1], p));
    if (k <= .001) { out.push({ id: l.id, k: 0 }); continue; }
    v3.copy(l.pos).project(ch.camera);
    const on = v3.z < 1 && Math.abs(v3.x) < 1.02 && Math.abs(v3.y) < 1.02;
    out.push({ id: l.id, k: on ? k : 0, x: (v3.x * .5 + .5) * vw, y: (.5 - v3.y * .5) * vh, side: l.side || 'right' });
  }
  return out;
}

let ui = null, site = null, inSite = false;
const soloFile = q.get('solo'), solo = soloFile?.replace(/-b$/, '');
let slow = 0, frames = 0;
function tick(dt) {
  t += dt;
  // 滾輪慣性已由 smooth-scroll.js 做（τ≈0.035+0.16s）；這裡只留 τ=0.05s 濾掉鍵盤／捲軸的跳動，避免雙重延遲（總延遲約 0.25s）
  // 分幕播放中 s 已由 beatFrame 直接設定，不再二次阻尼
  if (!beat.active) s += (target - s) * (reduced ? 1 : 1 - Math.exp(-dt * 20));
  if (Math.abs(target - s) < 1e-5) s = target;
  const px = ptr.x, py = ptr.y, k = 1 - Math.exp(-dt * 9);
  ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
  ptr.vx = (ptr.x - px) / Math.max(dt, .001); ptr.vy = (ptr.y - py) / Math.max(dt, .001);

  let i = solo ? TIMELINE.findIndex(x => x.id === solo) : TIMELINE.findIndex(x => s < x.b);
  if (i < 0) i = TIMELINE.length - 1;
  let ai = i, bi = -1, mix = 0;
  if (!solo) {
    if (i < TIMELINE.length - 1 && s > TIMELINE[i].b - W) { bi = i + 1; mix = (s - (TIMELINE[i].b - W)) / (2 * W); }
    else if (i > 0 && s < TIMELINE[i].a + W) { ai = i - 1; bi = i; mix = (s - (TIMELINE[i].a - W)) / (2 * W); }
  }
  const local = j => {
    if (solo) return s;
    const T = TIMELINE[j], a = j ? T.a - W : T.a, b = j < TIMELINE.length - 1 ? T.b + W : T.b;
    return clamp((s - a) / (b - a));
  };
  const A = chapters[TIMELINE[ai].id], B = bi >= 0 ? chapters[TIMELINE[bi].id] : null;
  const pa = local(ai), pb = bi >= 0 ? local(bi) : 0;
  renderer.info.reset();
  A.update(pa, t, dt, ptr); B?.update(pb, t, dt, ptr);
  const bA = A.bloom(pa), bB = B ? B.bloom(pb) : bA, e = mix * mix * (3 - 2 * mix);
  const theme = B ? lerp(A.theme(pa), B.theme(pb), e) : A.theme(pa);
  const bl = { strength: lerp(bA.strength, bB.strength, e), radius: lerp(bA.radius, bB.radius, e), threshold: lerp(bA.threshold, bB.threshold, e) };
  post.render(A, B, mix, TIMELINE[ai].mode, t, theme, bl);
  const cur = B && mix > .5 ? bi : ai, ch = chapters[TIMELINE[cur].id], p = local(cur);
  ch.camera.updateMatrixWorld();
  site?.setTheme(theme);
  ui?.update({ s, chapter: TIMELINE[cur].id, p, theme, t, dt, labels: B ? [] : projectLabels(ch, p) });
}

// 畫面太慢就降解析度（只降不升，避免來回跳）；重建 RT 會頓一下，所以等捲動停下才套用
let pendingDpr = false;
function adapt(dt) {
  if (pendingDpr && Math.abs(target - s) < 1e-4 && !beat.active && !window.__smoothScroll?.state.animating) { pendingDpr = false; resize(); }
  if (document.hidden || dt > .2) return;
  frames++; if (dt > 1 / 40) slow++;
  if (frames >= 90) { if (slow > 55 && dprScale > .6 && !pendingDpr) { dprScale *= .85; pendingDpr = true; } frames = slow = 0; }
}

async function boot() {
  const fill = document.getElementById('ld-fill'); let done = 0;
  const step = () => fill.style.setProperty('--k', (++done / (TIMELINE.length + 1)).toFixed(3));
  const ctx = { renderer, quality, touch, reduced };
  for (const { id } of TIMELINE) {
    if (solo && solo !== id) { step(); continue; }
    try { const m = await import(`./chapters/${solo === id ? soloFile : id}.js`); chapters[id] = await m.createChapter(ctx); }
    catch (err) { console.error(`[章節 ${id}]`, err); chapters[id] = placeholder(id); }
    step();
  }
  resize(); addEventListener('resize', resize);
  // 暖機：章節實際畫在 HalfFloat RT（無色調映射），所以要綁同規格 RT 再編譯，否則 program key 不同、進章才編譯而卡 1 秒以上。
  // 多個 p 都跑一次 update，讓依 p 切換 visible／材質的物件也編到；再實際畫到小 RT 上傳貼圖與 buffer。
  performance.mark('exo-warm');
  const warm = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType, samples: quality.msaa, depthBuffer: true });
  const WARM_P = [.02, .08, .15, .25, .35, .45, .5, .55, .65, .75, .85, .92, .98];
  for (const c of Object.values(chapters)) {
    for (const p of WARM_P) {
      try { c.update(p, 0, .016, ptr); renderer.setRenderTarget(warm); await renderer.compileAsync(c.scene, c.camera); }
      catch (err) { console.error(err); }
    }
  }
  for (const c of Object.values(chapters)) {
    for (const p of WARM_P) {
      try { c.update(p, 0, .016, ptr); renderer.setRenderTarget(warm); renderer.clear(); renderer.render(c.scene, c.camera); }
      catch (err) { console.error(err); }
    }
  }
  renderer.setRenderTarget(null); warm.dispose();
  try {
    const m = await import('./ui/ui.js');
    ui = m.mountUI(document.getElementById('ui'), { seek, TIMELINE, onConfig: c => chapters.vial?.set?.(c), touch, reduced });
  } catch (err) { console.error('[ui]', err); }
  try { const m = await import('./site/site.js'); site = m.mountSite(siteEl, { seek }); }
  catch (err) { console.error('[site]', err); }
  if (q.has('s')) seek(+q.get('s'), true); else target = s = clamp(scrollY / maxScroll());
  for (let k = 0; k < 2; k++) tick(.016);
  step(); document.getElementById('loader').classList.add('done'); performance.mark('exo-ready');
  let last = performance.now(); booted = true;
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, .25); last = now;
    beatFrame(now);
    const top = siteEl.getBoundingClientRect().top, now2 = top < innerHeight * .5;
    if (now2 !== inSite) { inSite = now2; site?.setInSite(inSite); document.body.classList.toggle('in-site', inSite); }
    if (frozen || top <= 0) { perf?.(now, dt, 0, -1); return; } // 官網內容蓋滿畫面時不渲染 3D
    const c0 = perf ? performance.now() : 0;
    adapt(dt); tick(Math.min(dt, .05));
    perf?.(now, dt, performance.now() - c0, 1);
  });
}

// 量測：?perf 時每格記錄 rAF 間隔、CPU tick、readPixels 同步時間、s、捲動位置（只供驗收用）
let perf = null;
if (q.has('perf')) {
  const log = [], px = new Uint8Array(4); let on = false;
  perf = (now, dt, cpu, drew) => {
    if (!on) return;
    let gpu = 0;
    if (drew > 0) { const g = renderer.getContext(), a = performance.now(); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); gpu = performance.now() - a; }
    log.push([+now.toFixed(2), +(dt * 1000).toFixed(2), +cpu.toFixed(2), +gpu.toFixed(2), +s.toFixed(5), +target.toFixed(5), Math.round(scrollY), dprScale]);
  };
  const lt = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) lt.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); }).observe({ entryTypes: ['longtask'] }); } catch {}
  const wh = [];
  addEventListener('wheel', e => { if (on) wh.push([+e.timeStamp.toFixed(1), e.deltaY]); }, { passive: true });
  window.__perf = { start() { log.length = lt.length = wh.length = 0; on = true; }, stop() { on = false; return JSON.stringify({ log, lt, wh }); } };
}

// 除錯與驗收：__demo.shot(0.3) 立即定位並把該格算好
window.__demo = {
  seek, tick, chapters, TIMELINE, renderer, ptr, BEATS, get s() { return s; }, get beat() { return { ...beat }; }, beatGo, freeze(v = true) { frozen = v; },
  shot(v, n = 90) { seek(v, true); for (let i = 0; i < n; i++) { target = s = clamp(v); tick(1 / 60); }
    const r = renderer.info.render; return { s, calls: r.calls, tris: r.triangles, points: r.points }; },
};
boot();
