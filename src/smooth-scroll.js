// 桌機滑鼠滾輪慣性平滑捲動。只接手「滑鼠滾輪」，其他捲動來源一律維持原生並同步目標值。
// 動態：目標 → 前置濾波(τ=0.035s) → 位置(τ=0.16s) 兩段指數逼近，速度連續、無回彈、與幀率無關。
const TAU_IN = 0.035, TAU = 0.16;     // 秒
const LINE = 33;                      // deltaMode 1 每行像素（每格約 3 行 ≈ 100px）
const GESTURE_GAP = 220;              // ms，超過即視為新一串手勢，重新判定
const FAST_GAP = 90, ACC_STEP = 0.05, ACC_MAX = 1.4, NOTCH_MAX = 360;

const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = matchMedia('(pointer: coarse)');
const enabled = () => !mqReduced.matches && !mqCoarse.matches;

const root = document.scrollingElement || document.documentElement;
const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
const clampY = y => Math.min(maxY(), Math.max(0, y));

let animating = false, raf = 0, lastT = 0;
let pos = 0, mid = 0, target = 0, lastSet = -1;
let gestureMode = '', lastWheel = 0, streak = 0;
let internal = false;
// 給 main.js 的分幕播放用：floor() 回傳官網內容區頂端（往上慣性捲動不越過它），onExternal 在外部程式捲動時呼叫
export const hooks = { floor: null, onExternal: null };

function sync() { pos = mid = target = scrollY; }

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; animating = false; lastSet = -1;
  sync();
}

function setScroll(y) {
  internal = true;
  origScrollTo.call(window, { top: y, behavior: 'instant' });
  internal = false;
  lastSet = y;
}

function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  // 外力（捲軸拖曳、瀏覽器自身捲動）改了位置：放手給原生
  if (lastSet >= 0 && Math.abs(scrollY - lastSet) > 3) { stop(); return; }
  target = clampY(target);
  mid += (target - mid) * (1 - Math.exp(-dt / TAU_IN));
  pos += (mid - pos) * (1 - Math.exp(-dt / TAU));
  if (Math.abs(target - pos) < 0.25 && Math.abs(target - mid) < 0.25) {
    pos = mid = target; setScroll(pos); animating = false; lastSet = -1; return;
  }
  setScroll(pos);
  raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf) return;
  animating = true; lastT = performance.now();
  raf = requestAnimationFrame(frame);
}

// 事件路徑上有可在該方向捲動的內層元素、或表單元件 → 交給原生
export function nativeInner(e, dy) {
  for (let n = e.target; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (!(n instanceof Element)) continue;
    const tag = n.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && n.type === 'range')) return true;
    if (n.isContentEditable) return true;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && n.scrollHeight > n.clientHeight + 1) {
      if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
    }
  }
  const so = getComputedStyle(document.body).overflowY, ro = getComputedStyle(document.documentElement).overflowY;
  return so === 'hidden' || ro === 'hidden'; // 選單開啟等鎖捲動狀態
}

export function classify(e) {
  if (e.deltaMode !== 0) return 'mouse';
  const dy = Math.abs(e.deltaY);
  if (e.deltaX !== 0 || dy < 50) return 'pad';
  if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0 && e.wheelDeltaY % 120 !== 0) return 'pad';
  return 'mouse';
}

function onWheel(e) {
  if (!enabled() || e.defaultPrevented) return;
  const now = performance.now();
  const gap = now - lastWheel; lastWheel = now;
  if (gap > GESTURE_GAP || !gestureMode) gestureMode = classify(e);
  if (gestureMode !== 'mouse') { if (animating) stop(); return; }
  if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) { if (animating) stop(); return; }
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
  let dy = e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? innerHeight * 0.9 : 1);
  dy = Math.max(-NOTCH_MAX, Math.min(NOTCH_MAX, dy));
  if (nativeInner(e, dy)) { if (animating) stop(); return; }

  e.preventDefault();
  if (!animating) { sync(); streak = 0; }
  else if (lastSet >= 0 && Math.abs(scrollY - lastSet) > 3) { sync(); streak = 0; }
  const dir = Math.sign(target - pos);
  if (dir && dir !== Math.sign(dy)) { target = mid = pos; streak = 0; } // 反向：丟掉餘量立即跟手
  streak = gap < FAST_GAP ? streak + 1 : 0;
  const mult = Math.min(ACC_MAX, 1 + ACC_STEP * Math.max(0, streak - 2));
  target = clampY(target + dy * mult);
  const fl = hooks.floor?.();
  if (dy < 0 && fl != null && pos >= fl - 2) target = Math.max(target, fl); // 內容區往上停在頂端，再滾一下才回 3D 最後一幕
  kick();
}

// 程式呼叫的捲動（seek、錨點平滑捲動）：先停下本模組再交給原生
const origScrollTo = window.scrollTo, origScroll = window.scroll, origScrollBy = window.scrollBy;
const origIntoView = Element.prototype.scrollIntoView;
const guard = fn => function (...a) { if (!internal) { hooks.onExternal?.(); if (animating) stop(); } return fn.apply(this, a); };
// 分幕播放每幀設定捲動位置用（不觸發 onExternal、不停本模組以外的東西）
export function rawScrollTo(y) {
  if (animating) stop();
  internal = true;
  origScrollTo.call(window, { top: y, behavior: 'instant' });
  internal = false;
}
window.scrollTo = guard(origScrollTo);
window.scroll = guard(origScroll);
window.scrollBy = guard(origScrollBy);
Element.prototype.scrollIntoView = guard(origIntoView);

addEventListener('wheel', onWheel, { passive: false });
addEventListener('scroll', () => { if (!animating) sync(); }, { passive: true });
const interrupt = () => { if (animating) stop(); };
addEventListener('keydown', interrupt, true);
addEventListener('touchstart', interrupt, { passive: true, capture: true });
addEventListener('mousedown', e => { if (e.clientX >= document.documentElement.clientWidth) interrupt(); }, true); // 捲軸
addEventListener('resize', interrupt);
document.addEventListener('visibilitychange', interrupt);
const onMq = () => { if (!enabled()) interrupt(); };
mqReduced.addEventListener?.('change', onMq);
mqCoarse.addEventListener?.('change', onMq);
sync();

window.__smoothScroll = { get state() { return { animating, pos, mid, target, gestureMode, streak }; }, stop };
