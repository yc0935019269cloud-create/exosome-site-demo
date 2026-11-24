// 全站 DOM 介面：場景標題、3D 標註引線、進度線、成品瓶組規格器（頂部固定導覽列由 src/site/ 負責）
import { brand, scenes, labelText, config, notice } from '../content.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;

const CHAPTER_ARIA = {
  vesicle: '第一章：外泌體構造',
  origin: '第二章：間質幹細胞生成',
  purify: '第三章：純化流程',
  vial: '第四章：規格配置',
};

const SCENE_WINDOWS = [
  { key: 'hero',   chapter: 'vesicle', a: 0.00, b: 0.24, immediate: true },
  { key: 'inside', chapter: 'vesicle', a: 0.32, b: 0.68 },
  { key: 'origin', chapter: 'origin',  a: 0.10, b: 0.35 },
  { key: 'tff',    chapter: 'purify',  a: 0.26, b: 0.46 },
  { key: 'sec',    chapter: 'purify',  a: 0.50, b: 0.64 },
  { key: 'nta',    chapter: 'purify',  a: 0.74, b: 0.92 },
];

const COLOR_CODED_LABELS = new Set(['cd9', 'cd63', 'cd81', 'rna']);
const USE_ACCENTS = {
  research: '#c9a25e',
  ingredient: '#639e92',
  process: '#847eb8',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/** 把標題依逗號切段並逐字包裹遮罩 span，避免中文斷在怪位置 */
function buildMaskedTitle(container, text) {
  const chars = [];
  const clauses = text.split(/(?<=，)|\n/);
  let idx = 0;
  for (const clause of clauses) {
    const cSpan = el('span', 'ui-clause');
    for (const ch of Array.from(clause)) {
      const mask = el('span', 'ui-ch-mask');
      const inner = el('span', 'ui-ch', ch);
      mask.appendChild(inner);
      cSpan.appendChild(mask);
      chars.push({ el: inner, idx: idx++ });
    }
    container.appendChild(cSpan);
  }
  return chars;
}

export function mountUI(root, { seek, TIMELINE, onConfig, touch, reduced }) {
  root.innerHTML = '';
  if (reduced) root.classList.add('ui-reduced');

  let vw = Math.max(window.innerWidth, 2);
  let vh = Math.max(window.innerHeight, 2);
  let isCompact = vw <= 860 || vh > vw * 1.05;

  // ─── 1. 場景標題（不含 vial，vial 標題放在組規格器內；避開頂部 72px 導覽列） ───
  const scenesLayer = el('div', 'ui-scenes');
  const sceneStates = SCENE_WINDOWS.map(def => {
    const data = scenes[def.key];
    const wrap = el('section', def.key === 'hero' ? 'ui-scene ui-scene--hero' : 'ui-scene');
    wrap.setAttribute('aria-hidden', 'true');
    const heading = el(def.key === 'hero' ? 'h1' : 'h2', 'ui-scene-title');
    const chars = buildMaskedTitle(heading, data.title);
    wrap.appendChild(heading);

    let subEl = null;
    if (data.sub) {
      subEl = el('p', 'ui-scene-sub', data.sub);
      wrap.appendChild(subEl);
    }

    let hintEl = null;
    if (def.key === 'hero') {
      hintEl = el('div', 'ui-scroll-hint');
      hintEl.append(el('span', 'ui-scroll-bar'), el('span', '', '向下捲動'));
      wrap.appendChild(hintEl);
    }

    scenesLayer.appendChild(wrap);
    return {
      ...def,
      wrap,
      chars,
      subEl,
      hintEl,
      enterT: def.immediate && reduced ? 1 : 0,
      visible: false,
      lastVis: -1,
      lastEnter: -1,
    };
  });
  root.appendChild(scenesLayer);

  // ─── 2. 3D 標註（預先建立全部節點，避免每幀增刪） ───
  const labelsLayer = el('div', 'ui-labels');
  const lblSvg = svgEl('svg', { class: 'ui-lbl-svg', 'aria-hidden': 'true' });
  labelsLayer.appendChild(lblSvg);

  const labelNodes = new Map();
  for (const [id, pair] of Object.entries(labelText)) {
    const mainTxt = pair[0] || '';
    const subTxt = pair[1] || '';

    const g = svgEl('g', { opacity: 0 });
    g.style.visibility = 'hidden';
    const path = svgEl('path', {
      class: 'ui-lbl-line',
      pathLength: 1,
      'stroke-dasharray': 1,
      'stroke-dashoffset': 1,
    });
    const ring = svgEl('circle', { class: 'ui-lbl-ring', r: 5.5 });
    const dot = svgEl('circle', { class: 'ui-lbl-dot', r: 2.5 });
    if (COLOR_CODED_LABELS.has(id)) {
      dot.setAttribute('data-code', id);
      ring.setAttribute('data-code', id);
    }
    g.append(path, ring, dot);
    lblSvg.appendChild(g);

    const txt = el('div', 'ui-lbl-txt');
    txt.appendChild(el('span', 'ui-lbl-main', mainTxt));
    if (subTxt) txt.appendChild(el('span', 'ui-lbl-sub', subTxt));
    labelsLayer.appendChild(txt);

    const estW = Math.max(mainTxt.length * 14.5, subTxt.length * 12.5) + 16;
    labelNodes.set(id, {
      id,
      g,
      path,
      ring,
      dot,
      txt,
      estW,
      hasSub: Boolean(subTxt),
      k: 0,
      ax: 0,
      ay: 0,
      ex: 0,
      ey: 0,
      side: 'right',
      shown: false,
      seeded: false,
    });
  }
  root.appendChild(labelsLayer);

  // ─── 3. 右側進度線＋手機底部細線 ───
  const rail = el('nav', 'ui-rail');
  rail.setAttribute('aria-label', '章節進度');
  const railTrack = el('div', 'ui-rail-track');
  rail.appendChild(railTrack);

  const railButtons = TIMELINE.map((seg, idx) => {
    const btn = el('button', 'ui-rail-seg');
    btn.type = 'button';
    btn.style.flex = `${Math.max(0.05, seg.b - seg.a)} 0 0`;
    btn.setAttribute('aria-label', CHAPTER_ARIA[seg.id] || `章節 ${idx + 1}`);
    const mid = idx === TIMELINE.length - 1 ? 0.92 : (seg.a + seg.b) * 0.5;
    btn.addEventListener('click', () => seek(mid));
    rail.appendChild(btn);
    return { id: seg.id, btn };
  });

  const railPearl = el('span', 'ui-rail-pearl');
  railPearl.setAttribute('aria-hidden', 'true');
  rail.appendChild(railPearl);
  root.appendChild(rail);

  const mobileBar = el('div', 'ui-mobile-bar');
  mobileBar.setAttribute('aria-hidden', 'true');
  const mobileBarFill = el('div', 'ui-mobile-bar-fill');
  mobileBar.appendChild(mobileBarFill);
  root.appendChild(mobileBar);

  // ─── 4. 成品瓶組規格器（vial p >= 0.45） ───
  const cfgState = {
    source: 'uc',
    form: 'lyo',
    use: 'ingredient',
    qc: ['nta', 'marker'],
  };

  const cfgPanel = el('aside', 'cfg-panel');
  cfgPanel.setAttribute('aria-label', scenes.vial.title);
  cfgPanel.setAttribute('aria-hidden', 'true');

  const cfgTitle = el('h2', 'cfg-title');
  const cfgTitleChars = buildMaskedTitle(cfgTitle, scenes.vial.title);
  cfgPanel.appendChild(cfgTitle);

  const cfgForm = el('div', 'cfg-form');
  const sliderRefs = [];
  const radioGroups = new Map();

  function buildOptionCode() {
    const sOpt = config.source.options.find(o => o.id === cfgState.source);
    const fOpt = config.form.options.find(o => o.id === cfgState.form);
    const uOpt = config.use.options.find(o => o.id === cfgState.use);
    return `${sOpt?.code || ''}-${fOpt?.code || ''}-${uOpt?.code || ''}`;
  }

  function buildPlainOrderText(code) {
    const sName = config.source.options.find(o => o.id === cfgState.source)?.name || '';
    const fName = config.form.options.find(o => o.id === cfgState.form)?.name || '';
    const uName = config.use.options.find(o => o.id === cfgState.use)?.name || '';
    const qcNames = config.qc.options
      .filter(o => cfgState.qc.includes(o.id))
      .map(o => o.name);
    return [
      `${brand.zh}${brand.en ? " " + brand.en : ""}｜外泌體規格需求單`,
      `規格碼：${code}`,
      `${config.source.label}：${sName}`,
      `${config.form.label}：${fName}`,
      `${config.use.label}：${uName}`,
      `${config.qc.label}：${qcNames.length ? qcNames.join('、') : '無'}`,
      '',
      notice,
    ].join('\n');
  }

  for (const key of ['source', 'form', 'use', 'qc']) {
    const def = config[key];
    const fs = el('fieldset', 'cfg-group');
    fs.dataset.key = key;
    fs.appendChild(el('legend', 'cfg-legend', def.label));

    const isMulti = Boolean(def.multi);
    const row = el('div', isMulti ? 'cfg-row cfg-row--multi' : 'cfg-row');
    const optLabels = new Map();

    for (const opt of def.options) {
      const lbl = el('label', isMulti ? 'cfg-opt cfg-opt--multi' : 'cfg-opt');
      const input = document.createElement('input');
      input.type = isMulti ? 'checkbox' : 'radio';
      input.name = `cfg-${key}`;
      input.value = opt.id;
      input.className = 'sr-only';

      const checked = isMulti ? cfgState.qc.includes(opt.id) : cfgState[key] === opt.id;
      input.checked = checked;
      if (checked) lbl.classList.add('is-checked');

      input.addEventListener('focus', () => {
        if (input.matches(':focus-visible')) lbl.classList.add('is-focused');
      });
      input.addEventListener('blur', () => lbl.classList.remove('is-focused'));
      input.addEventListener('change', () => {
        if (isMulti) {
          const next = new Set(cfgState.qc);
          if (input.checked) next.add(opt.id);
          else next.delete(opt.id);
          cfgState.qc = def.options.filter(o => next.has(o.id)).map(o => o.id);
          lbl.classList.toggle('is-checked', input.checked);
        } else {
          cfgState[key] = opt.id;
          for (const [id, node] of optLabels) {
            node.classList.toggle('is-checked', id === opt.id);
          }
          positionSlider(key);
        }
        emitConfig(true);
      });

      lbl.appendChild(input);
      if (isMulti) {
        const dot = el('span', 'cfg-chk-dot');
        dot.setAttribute('aria-hidden', 'true');
        lbl.appendChild(dot);
      }
      lbl.appendChild(el('span', 'cfg-opt-txt', opt.name));
      row.appendChild(lbl);
      optLabels.set(opt.id, lbl);
    }

    if (!isMulti) {
      const line = el('span', 'cfg-slider-line');
      const dot = el('span', 'cfg-slider-dot');
      line.setAttribute('aria-hidden', 'true');
      dot.setAttribute('aria-hidden', 'true');
      row.append(line, dot);
      const ref = { key, row, optLabels, line, dot };
      sliderRefs.push(ref);
      radioGroups.set(key, ref);
    }

    fs.appendChild(row);
    cfgForm.appendChild(fs);
  }
  cfgPanel.appendChild(cfgForm);

  // 規格碼滾動列
  const codeRow = el('div', 'cfg-code-row');
  const codeLeft = el('div', 'cfg-code-left');
  codeLeft.appendChild(el('span', 'cfg-code-label', '規格碼'));
  const codeValEl = el('div', 'cfg-code-value');
  codeValEl.setAttribute('aria-live', 'polite');
  codeLeft.appendChild(codeValEl);
  const codeQcEl = el('div', 'cfg-code-qc');
  codeRow.append(codeLeft, codeQcEl);
  cfgPanel.appendChild(codeRow);

  let currentCode = '';
  let codeSlots = [];

  function renderCode(nextCode, animate) {
    const prevChars = Array.from(currentCode);
    const nextChars = Array.from(nextCode);
    codeValEl.setAttribute('aria-label', nextCode);

    if (codeSlots.length !== nextChars.length) {
      codeValEl.innerHTML = '';
      codeSlots = nextChars.map(ch => {
        const slot = el('span', 'cfg-slot');
        const track = el('span', 'cfg-slot-track');
        const c1 = el('span', 'cfg-slot-ch', ch);
        const c2 = el('span', 'cfg-slot-ch', ch);
        track.append(c1, c2);
        slot.appendChild(track);
        codeValEl.appendChild(slot);
        return { track, c1, c2, anim: null };
      });
    } else {
      for (let i = 0; i < nextChars.length; i++) {
        const slot = codeSlots[i];
        const prev = prevChars[i] ?? nextChars[i];
        const next = nextChars[i];
        if (prev === next) {
          slot.c1.textContent = next;
          slot.c2.textContent = next;
          continue;
        }
        if (!animate || reduced || !slot.track.animate) {
          slot.c1.textContent = next;
          slot.c2.textContent = next;
          slot.track.style.transform = 'translateY(0)';
          continue;
        }
        slot.anim?.cancel();
        slot.c1.textContent = prev;
        slot.c2.textContent = next;
        slot.anim = slot.track.animate(
          [{ transform: 'translateY(0)' }, { transform: 'translateY(-50%)' }],
          { duration: 290, delay: i * 32, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
        slot.anim.onfinish = () => {
          slot.c1.textContent = next;
          slot.track.style.transform = 'translateY(0)';
          slot.anim?.cancel();
          slot.anim = null;
        };
      }
    }
    currentCode = nextCode;

    const qcCodes = config.qc.options
      .filter(o => cfgState.qc.includes(o.id))
      .map(o => o.code);
    codeQcEl.textContent = qcCodes.length ? qcCodes.join(' · ') : '—';
  }

  // 操作按鈕
  const actions = el('div', 'cfg-actions');
  const copyBtn = el('button', 'cfg-btn cfg-btn--primary', '複製需求單');
  copyBtn.type = 'button';
  const topBtn = el('button', 'cfg-btn cfg-btn--secondary', '回到開頭');
  topBtn.type = 'button';
  topBtn.addEventListener('click', () => seek(0));
  actions.append(copyBtn, topBtn);

  let mailLink = null;
  if (brand.email && brand.email.trim()) {
    mailLink = el('a', 'cfg-btn cfg-btn--secondary', '寄出');
    actions.appendChild(mailLink);
  }
  cfgPanel.appendChild(actions);

  const fallbackArea = el('textarea', 'cfg-fallback');
  fallbackArea.readOnly = true;
  fallbackArea.setAttribute('aria-label', '需求單純文字內容');
  cfgPanel.appendChild(fallbackArea);

  const noticeEl = el('p', 'cfg-notice', notice);
  cfgPanel.appendChild(noticeEl);
  root.appendChild(cfgPanel);

  let copyTimer = 0;
  function showFallbackSelect(text) {
    fallbackArea.value = text;
    fallbackArea.classList.add('is-visible');
    fallbackArea.focus();
    fallbackArea.select();
    fallbackArea.setSelectionRange(0, text.length);
  }

  copyBtn.addEventListener('click', async () => {
    const text = buildPlainOrderText(currentCode);
    clearTimeout(copyTimer);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        fallbackArea.classList.remove('is-visible');
        copyBtn.textContent = '已複製';
        copyTimer = setTimeout(() => { copyBtn.textContent = '複製需求單'; }, 2200);
        return;
      } catch {
        // 回退至選取可見文字
      }
    }
    showFallbackSelect(text);
  });

  function positionSlider(key) {
    const ref = radioGroups.get(key);
    if (!ref) return;
    const active = ref.optLabels.get(cfgState[key]);
    if (!active) return;
    const x = active.offsetLeft;
    const w = active.offsetWidth;
    if (w <= 0) return;
    ref.line.style.transform = `translate3d(${x}px, 0, 0) scaleX(${w})`;
    ref.dot.style.transform = `translate3d(${(x + w * 0.5 - 2.5).toFixed(1)}px, 0, 0)`;
  }

  function positionAllSliders() {
    for (const ref of sliderRefs) positionSlider(ref.key);
  }

  function emitConfig(animateCode) {
    const code = buildOptionCode();
    root.style.setProperty('--use-accent', USE_ACCENTS[cfgState.use] || '#639e92');
    renderCode(code, animateCode);
    if (mailLink) {
      const subject = encodeURIComponent(`${brand.zh} 外泌體規格洽詢（${code}）`);
      const body = encodeURIComponent(buildPlainOrderText(code));
      mailLink.href = `mailto:${brand.email.trim()}?subject=${subject}&body=${body}`;
    }
    if (fallbackArea.classList.contains('is-visible')) {
      fallbackArea.value = buildPlainOrderText(code);
    }
    onConfig?.({
      source: cfgState.source,
      form: cfgState.form,
      use: cfgState.use,
      qc: [...cfgState.qc],
      code,
    });
  }

  // 掛載時先呼叫一次 onConfig，並在排版與字型就緒後對齊滑動底線
  emitConfig(false);
  requestAnimationFrame(positionAllSliders);
  document.fonts?.ready?.then(positionAllSliders);

  let railH = 220;
  function onResize() {
    vw = Math.max(window.innerWidth, 2);
    vh = Math.max(window.innerHeight, 2);
    isCompact = vw <= 860 || vh > vw * 1.05;
    railH = rail.offsetHeight || clamp(vh * 0.3, 180, 290);
    for (const sc of sceneStates) sc.lastVis = -1;
    lastCfgVis = -1;
    positionAllSliders();
  }
  window.addEventListener('resize', onResize, { passive: true });
  railH = rail.offsetHeight || clamp(vh * 0.3, 180, 290);

  // ─── 狀態快取（減少不必要 DOM 寫入） ───
  let lastTheme = -1;
  let lastChapter = '';
  let lastS = -1;
  let cfgOpen = false;
  let cfgEnterT = reduced ? 1 : 0;
  let lastCfgVis = -1;
  let lastCfgEnter = -1;
  let cfgSlidersSynced = false;

  const activeLeft = [];
  const activeRight = [];
  const labelMap = new Map();

  function relaxVertical(list, minGap, minY, maxY) {
    if (list.length === 0) return;
    list.sort((a, b) => a.ty - b.ty);
    for (let i = 0; i < list.length; i++) {
      list[i].ry = clamp(list[i].ty, minY, maxY);
      if (i > 0 && list[i].ry - list[i - 1].ry < minGap) {
        list[i].ry = list[i - 1].ry + minGap;
      }
    }
    const last = list[list.length - 1];
    if (last.ry > maxY) {
      last.ry = maxY;
      for (let i = list.length - 2; i >= 0; i--) {
        if (list[i + 1].ry - list[i].ry < minGap) {
          list[i].ry = Math.max(minY, list[i + 1].ry - minGap);
        }
      }
    }
  }

  function applyTheme(theme) {
    const tClamped = clamp(theme);
    if (Math.abs(tClamped - lastTheme) < 0.001) return;
    lastTheme = tClamped;
    const k = tClamped * tClamped * (3 - 2 * tClamped);
    const r = Math.round(lerp(238, 16, k));
    const g = Math.round(lerp(240, 22, k));
    const b = Math.round(lerp(236, 26, k));
    const ir = Math.round(lerp(11, 238, k));
    const ig = Math.round(lerp(15, 240, k));
    const ib = Math.round(lerp(20, 236, k));
    const docStyle = document.documentElement.style;
    docStyle.setProperty('--theme', tClamped.toFixed(4));
    docStyle.setProperty('--fg-rgb', `${r}, ${g}, ${b}`);
    docStyle.setProperty('--inv-rgb', `${ir}, ${ig}, ${ib}`);
  }

  function updateScenes(chapter, p, s, dt) {
    for (const sc of sceneStates) {
      let vis = 0;
      if (chapter === sc.chapter) {
        if (sc.immediate) {
          vis = 1 - smooth(sc.b - 0.05, sc.b, p);
        } else {
          vis = smooth(sc.a, sc.a + 0.04, p) * (1 - smooth(sc.b - 0.04, sc.b, p));
        }
      }

      const active = vis > 0.004;
      if (active) {
        if (!sc.visible) {
          sc.visible = true;
          sc.wrap.style.visibility = 'visible';
          sc.wrap.setAttribute('aria-hidden', 'false');
          if (!reduced && !sc.immediate) sc.enterT = 0;
        }
        sc.enterT = reduced ? 1 : Math.min(1, sc.enterT + dt * 1.9);
      } else {
        if (sc.visible) {
          sc.visible = false;
          sc.wrap.style.visibility = 'hidden';
          sc.wrap.style.opacity = '0';
          sc.wrap.setAttribute('aria-hidden', 'true');
          sc.enterT = reduced ? 1 : 0;
          sc.lastVis = 0;
          sc.lastEnter = sc.enterT;
        }
        continue;
      }

      const changedVis = Math.abs(vis - sc.lastVis) > 0.001;
      const changedEnter = Math.abs(sc.enterT - sc.lastEnter) > 0.001;

      if (changedVis) {
        sc.lastVis = vis;
        sc.wrap.style.opacity = vis.toFixed(3);
        const exitLift = (1 - vis) * -10;
        if (sc.key === 'hero' && !isCompact) {
          sc.wrap.style.transform = `translate3d(0, calc(-50% + ${exitLift.toFixed(1)}px), 0)`;
        } else {
          sc.wrap.style.transform = `translate3d(0, ${exitLift.toFixed(1)}px, 0)`;
        }
      }

      if (changedEnter) {
        sc.lastEnter = sc.enterT;
        const n = sc.chars.length;
        for (let i = 0; i < n; i++) {
          const ch = sc.chars[i];
          if (reduced) {
            ch.el.style.transform = 'translate3d(0, 0, 0)';
          } else {
            const delay = i * 0.032;
            const u = clamp((sc.enterT - delay) / 0.45);
            const ease = 1 - Math.pow(1 - u, 3);
            const yPct = (1 - ease) * 112;
            ch.el.style.transform = `translate3d(0, ${yPct.toFixed(1)}%, 0)`;
          }
        }
        if (sc.subEl) {
          const su = reduced ? 1 : clamp((sc.enterT - 0.18) / 0.42);
          const se = 1 - Math.pow(1 - su, 3);
          sc.subEl.style.opacity = se.toFixed(3);
          sc.subEl.style.transform = `translate3d(0, ${((1 - se) * 10).toFixed(1)}px, 0)`;
        }
      }

      if (sc.hintEl) {
        const hk = (1 - smooth(0.01, 0.06, s)) * vis;
        sc.hintEl.style.opacity = hk.toFixed(3);
      }
    }
  }

  function updateConfigurator(chapter, p, dt) {
    const vis = chapter === 'vial' ? smooth(0.45, 0.54, p) : 0;
    const open = vis > 0.02;

    if (open) {
      if (!cfgOpen) {
        cfgOpen = true;
        cfgPanel.style.visibility = 'visible';
        cfgPanel.classList.add('is-open');
        cfgPanel.setAttribute('aria-hidden', 'false');
        cfgEnterT = reduced ? 1 : 0;
        lastCfgEnter = -1;
        if (!cfgSlidersSynced) {
          cfgSlidersSynced = true;
          positionAllSliders();
        }
      }
      cfgEnterT = reduced ? 1 : Math.min(1, cfgEnterT + dt * 2.0);
    } else if (cfgOpen || lastCfgVis < 0) {
      cfgOpen = false;
      cfgPanel.style.visibility = 'hidden';
      cfgPanel.style.opacity = '0';
      cfgPanel.classList.remove('is-open');
      cfgPanel.setAttribute('aria-hidden', 'true');
      cfgEnterT = reduced ? 1 : 0;
      lastCfgVis = 0;
      lastCfgEnter = -1;
      return;
    } else {
      return;
    }

    if (Math.abs(vis - lastCfgVis) > 0.001) {
      lastCfgVis = vis;
      cfgPanel.style.opacity = vis.toFixed(3);
      const slideY = reduced ? 0 : (1 - vis) * 16;
      if (isCompact) {
        cfgPanel.style.transform = `translate3d(0, ${slideY.toFixed(1)}px, 0)`;
      } else {
        cfgPanel.style.transform = `translate3d(0, calc(-50% + ${slideY.toFixed(1)}px), 0)`;
      }
    }

    if (Math.abs(cfgEnterT - lastCfgEnter) > 0.001) {
      lastCfgEnter = cfgEnterT;
      for (let i = 0; i < cfgTitleChars.length; i++) {
        const ch = cfgTitleChars[i];
        if (reduced) {
          ch.el.style.transform = 'translate3d(0, 0, 0)';
        } else {
          const u = clamp((cfgEnterT - i * 0.03) / 0.45);
          const ease = 1 - Math.pow(1 - u, 3);
          ch.el.style.transform = `translate3d(0, ${((1 - ease) * 112).toFixed(1)}%, 0)`;
        }
      }
    }
  }

  function updateLabels(labels, dt) {
    labelMap.clear();
    if (labels) {
      for (let i = 0; i < labels.length; i++) {
        labelMap.set(labels[i].id, labels[i]);
      }
    }

    activeLeft.length = 0;
    activeRight.length = 0;

    const leaderLen = isCompact ? 32 : 62;
    const marginX = isCompact ? 12 : 28;
    const topSafe = isCompact ? 82 : 92; // 避開頂部 72px 全站固定導覽列
    const bottomSafe = isCompact ? 172 : 156;
    const minGap = isCompact ? 38 : 46;

    for (const node of labelNodes.values()) {
      const item = labelMap.get(node.id);
      const targetK = item && item.k > 0.002 ? clamp(item.k) : 0;

      if (targetK <= 0) {
        if (node.k > 0.002) {
          node.k = reduced ? 0 : node.k * Math.exp(-dt * 16);
          if (node.k <= 0.002) {
            node.k = 0;
            node.shown = false;
            node.seeded = false;
            node.g.style.visibility = 'hidden';
            node.g.setAttribute('opacity', '0');
            node.txt.style.visibility = 'hidden';
            node.txt.style.opacity = '0';
          } else {
            node.g.setAttribute('opacity', node.k.toFixed(3));
            node.txt.style.opacity = node.k.toFixed(3);
            node.path.setAttribute('stroke-dashoffset', (1 - node.k).toFixed(3));
          }
        }
        continue;
      }

      const ax = clamp(item.x, marginX, vw - marginX);
      const ay = clamp(item.y, topSafe, vh - 40);
      let side = item.side === 'left' ? 'left' : 'right';

      if (side === 'right' && ax + leaderLen + node.estW > vw - marginX && ax - leaderLen - node.estW >= marginX) {
        side = 'left';
      } else if (side === 'left' && ax - leaderLen - node.estW < marginX && ax + leaderLen + node.estW <= vw - marginX) {
        side = 'right';
      }

      const entry = { node, targetK, ax, ay, ty: ay, ry: ay, side };
      if (side === 'left') activeLeft.push(entry);
      else activeRight.push(entry);
    }

    relaxVertical(activeLeft, minGap, topSafe, vh - bottomSafe);
    relaxVertical(activeRight, minGap, topSafe, vh - bottomSafe);

    const smoothK = reduced ? 1 : 1 - Math.exp(-dt * 13);
    const processGroup = list => {
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const { node, targetK, ax, ay, ry, side } = it;
        const dir = side === 'left' ? -1 : 1;
        const rawEx = ax + dir * leaderLen;
        const ex = side === 'right'
          ? Math.min(rawEx, vw - marginX - node.estW)
          : Math.max(rawEx, marginX + node.estW);
        const ey = ry;

        if (!node.seeded) {
          node.ax = ax;
          node.ay = ay;
          node.ex = ex;
          node.ey = ey;
          node.seeded = true;
        } else {
          node.ax += (ax - node.ax) * smoothK;
          node.ay += (ay - node.ay) * smoothK;
          node.ex += (ex - node.ex) * smoothK;
          node.ey += (ey - node.ey) * smoothK;
        }
        node.k += (targetK - node.k) * (reduced ? 1 : 1 - Math.exp(-dt * 16));

        if (!node.shown) {
          node.shown = true;
          node.g.style.visibility = 'visible';
          node.txt.style.visibility = 'visible';
        }
        if (node.side !== side) {
          node.side = side;
          node.txt.dataset.side = side;
        }

        const kStr = node.k.toFixed(3);
        const grow = clamp(node.k * 1.15);
        node.g.setAttribute('opacity', kStr);
        node.dot.setAttribute('cx', node.ax.toFixed(1));
        node.dot.setAttribute('cy', node.ay.toFixed(1));
        node.ring.setAttribute('cx', node.ax.toFixed(1));
        node.ring.setAttribute('cy', node.ay.toFixed(1));

        const dy = node.ey - node.ay;
        let d;
        if (Math.abs(dy) < 2) {
          d = `M${node.ax.toFixed(1)},${node.ay.toFixed(1)} L${node.ex.toFixed(1)},${node.ey.toFixed(1)}`;
        } else {
          const elbowSpan = Math.min(Math.abs(node.ex - node.ax) * 0.45, Math.abs(dy));
          const mx = node.ax + dir * elbowSpan;
          d = `M${node.ax.toFixed(1)},${node.ay.toFixed(1)} L${mx.toFixed(1)},${node.ey.toFixed(1)} L${node.ex.toFixed(1)},${node.ey.toFixed(1)}`;
        }
        node.path.setAttribute('d', d);
        node.path.setAttribute('stroke-dashoffset', (1 - grow).toFixed(3));

        const txtX = node.ex + dir * 8;
        const txtY = node.ey - (node.hasSub ? 14 : 8);
        const alignShift = side === 'left' ? '-100%' : '0%';
        node.txt.style.opacity = clamp((node.k - 0.15) / 0.85).toFixed(3);
        node.txt.style.transform = `translate3d(${txtX.toFixed(1)}px, ${txtY.toFixed(1)}px, 0) translateX(${alignShift})`;
      }
    };

    processGroup(activeLeft);
    processGroup(activeRight);
  }

  function updateProgress(s, chapter) {
    if (Math.abs(s - lastS) > 0.0004) {
      lastS = s;
      const py = clamp(s) * railH;
      railPearl.style.transform = `translate3d(0, ${py.toFixed(1)}px, 0)`;
      mobileBarFill.style.transform = `scaleX(${clamp(s).toFixed(4)})`;
    }
    if (chapter !== lastChapter) {
      lastChapter = chapter;
      for (const item of railButtons) {
        if (item.id === chapter) item.btn.setAttribute('aria-current', 'step');
        else item.btn.removeAttribute('aria-current');
      }
    }
  }

  return {
    update({ s, chapter, p, theme, dt, labels }) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.08);
      applyTheme(theme);
      updateProgress(s, chapter);
      updateScenes(chapter, p, s, safeDt);
      updateConfigurator(chapter, p, safeDt);
      updateLabels(labels, safeDt);
    },
  };
}
