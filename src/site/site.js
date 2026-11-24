// 維析生技 VESIRA 官網內容區與全站固定導覽列
import { brand } from '../content.js';
import {
  nav,
  platform,
  services,
  quality,
  process as processData,
  about,
  contact,
  footer,
} from '../site-content.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function svgMarkup(str) {
  const tpl = document.createElement('template');
  tpl.innerHTML = str.trim();
  return tpl.content.firstElementChild;
}

/* 品牌標誌：圓膜內三個點（CD9 琥珀、CD63 玉、CD81 紫） */
function createBrandLogo(className = 'site-nav__logo') {
  return svgMarkup(`
    <svg class="${className}" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="11.5" stroke="currentColor" stroke-width="1.25" />
      <circle cx="14" cy="14" r="8.2" stroke="currentColor" stroke-width="0.7" stroke-opacity="0.45" />
      <circle cx="10.4" cy="11.4" r="1.7" fill="#f2b84b" />
      <circle cx="17.8" cy="11.8" r="1.7" fill="#3fc7b0" />
      <circle cx="14.2" cy="17.8" r="1.7" fill="#9b8cff" />
    </svg>
  `);
}

/* Platform 步驟線稿 SVG（01 細胞／02 培養液澄清／03 管壁過濾／04 分布曲線） */
function createPlatformSvg(index) {
  const svgs = [
    // 01: MSC 紡錘狀間質幹細胞（纖維母細胞樣多極伸展）＋細胞核＋多囊泡體 MVB 釋放外泌體
    `<svg class="site-plat-svg" data-svg-step="0" viewBox="0 0 360 225" fill="none" aria-hidden="true">
      <path d="M18 148 C58 134, 96 106, 134 86 C168 68, 206 72, 236 92 C266 112, 298 118, 342 112 C304 128, 268 142, 240 156 C206 172, 166 172, 128 158 C92 146, 56 150, 18 148 Z"
            stroke="#10161a" stroke-width="1.25" />
      <path d="M98 148 C86 164, 72 178, 52 186 C76 176, 98 166, 118 156"
            stroke="#10161a" stroke-width="1.1" />
      <path d="M44 143 C76 130, 108 108, 140 93 C170 79, 202 82, 230 98 C258 114, 286 121, 316 118 C284 130, 256 142, 232 152 C202 164, 168 164, 134 152 C104 142, 74 144, 44 143 Z"
            stroke="#10161a" stroke-width="0.6" stroke-opacity="0.24" stroke-dasharray="3 3" />
      <ellipse cx="152" cy="124" rx="30" ry="18" transform="rotate(-8 152 124)" stroke="#10161a" stroke-width="1.15" />
      <circle cx="146" cy="122" r="5.5" stroke="#10161a" stroke-width="0.9" fill="#10161a" fill-opacity="0.08" />
      <path d="M186 110 C196 104, 204 112, 196 120 C188 128, 198 136, 208 130"
            stroke="#10161a" stroke-width="0.85" stroke-opacity="0.5" />
      <circle cx="228" cy="118" r="15" stroke="#3fc7b0" stroke-width="1.2" />
      <g class="site-svg-float">
        <circle cx="223" cy="115" r="2.5" stroke="#10161a" stroke-width="0.9" fill="#3fc7b0" fill-opacity="0.55" />
        <circle cx="233" cy="114" r="2.3" stroke="#10161a" stroke-width="0.9" fill="#f2b84b" fill-opacity="0.6" />
        <circle cx="228" cy="124" r="2.5" stroke="#10161a" stroke-width="0.9" fill="#9b8cff" fill-opacity="0.55" />
      </g>
      <path d="M242 106 C254 94, 266 82, 278 70" stroke="#10161a" stroke-width="0.8" stroke-dasharray="2 3" stroke-opacity="0.55" />
      <g class="site-svg-float-b">
        <circle cx="272" cy="64" r="4.4" stroke="#10161a" stroke-width="1" fill="#eef0ec" />
        <circle cx="272" cy="64" r="1.4" fill="#3fc7b0" />
        <circle cx="294" cy="48" r="3.6" stroke="#10161a" stroke-width="0.95" fill="#eef0ec" />
        <circle cx="294" cy="48" r="1.2" fill="#f2b84b" />
        <circle cx="308" cy="70" r="4" stroke="#10161a" stroke-width="0.95" fill="#eef0ec" />
        <circle cx="308" cy="70" r="1.2" fill="#9b8cff" />
      </g>
      <line x1="20" y1="202" x2="340" y2="202" stroke="#10161a" stroke-width="0.6" stroke-opacity="0.22" />
    </svg>`,

    // 02: 條件培養液澄清（細胞碎片下沉、澄清上清液帶外泌體流出）
    `<svg class="site-plat-svg" data-svg-step="1" viewBox="0 0 360 225" fill="none" aria-hidden="true">
      <path d="M96 34 L96 146 L142 192 L182 192 L228 146 L228 34" stroke="#10161a" stroke-width="1.25" />
      <line x1="88" y1="34" x2="236" y2="34" stroke="#10161a" stroke-width="1.1" />
      <path d="M97 72 Q162 66 227 72" stroke="#10161a" stroke-width="0.9" stroke-opacity="0.45" />
      <path d="M228 96 L320 96 M228 112 L320 112" stroke="#10161a" stroke-width="1.1" />
      <line x1="100" y1="142" x2="224" y2="142" stroke="#f2b84b" stroke-width="0.9" stroke-dasharray="4 3" />
      <g class="site-svg-settle">
        <polygon points="122,122 132,126 128,136 118,132" stroke="#10161a" stroke-width="1" fill="#10161a" fill-opacity="0.14" />
        <polygon points="164,130 176,128 178,139 166,142" stroke="#10161a" stroke-width="1" fill="#10161a" fill-opacity="0.14" />
        <polygon points="194,118 206,122 200,132 190,128" stroke="#10161a" stroke-width="1" fill="#10161a" fill-opacity="0.14" />
      </g>
      <path d="M126 168 Q162 158 198 168 L180 188 L144 188 Z" fill="#10161a" fill-opacity="0.16" stroke="#10161a" stroke-width="0.9" />
      <g class="site-svg-flow">
        <circle cx="152" cy="102" r="3.4" stroke="#10161a" stroke-width="1" fill="#3fc7b0" fill-opacity="0.45" />
        <circle cx="192" cy="105" r="3.4" stroke="#10161a" stroke-width="1" fill="#3fc7b0" fill-opacity="0.45" />
        <circle cx="256" cy="104" r="3.6" stroke="#10161a" stroke-width="1" fill="#3fc7b0" fill-opacity="0.6" />
        <circle cx="290" cy="104" r="3.6" stroke="#10161a" stroke-width="1" fill="#f2b84b" fill-opacity="0.65" />
      </g>
      <path d="M326 104 L338 104 M333 99 L338 104 L333 109" stroke="#10161a" stroke-width="1.15" />
    </svg>`,

    // 03: 中空纖維切向流過濾 TFF（外泌體沿管腔前進，小分子游離蛋白穿透管壁孔隙）
    `<svg class="site-plat-svg" data-svg-step="2" viewBox="0 0 360 225" fill="none" aria-hidden="true">
      <line x1="28" y1="50" x2="332" y2="50" stroke="#10161a" stroke-width="0.8" stroke-opacity="0.3" />
      <line x1="28" y1="176" x2="332" y2="176" stroke="#10161a" stroke-width="0.8" stroke-opacity="0.3" />
      <line x1="28" y1="84" x2="332" y2="84" stroke="#10161a" stroke-width="1.6" stroke-dasharray="16 8" />
      <line x1="28" y1="142" x2="332" y2="142" stroke="#10161a" stroke-width="1.6" stroke-dasharray="16 8" />
      <line x1="28" y1="113" x2="328" y2="113" stroke="#9b8cff" stroke-width="0.7" stroke-opacity="0.45" stroke-dasharray="3 4" />
      <path d="M326 113 L338 113 M333 108 L338 113 L333 118" stroke="#10161a" stroke-width="1.2" />
      <g class="site-svg-flow">
        <circle cx="84" cy="108" r="6" stroke="#10161a" stroke-width="1.1" fill="#eef0ec" />
        <circle cx="84" cy="108" r="2" fill="#3fc7b0" />
        <circle cx="152" cy="118" r="6.5" stroke="#10161a" stroke-width="1.1" fill="#eef0ec" />
        <circle cx="152" cy="118" r="2" fill="#9b8cff" />
        <circle cx="222" cy="106" r="5.8" stroke="#10161a" stroke-width="1.1" fill="#eef0ec" />
        <circle cx="222" cy="106" r="2" fill="#f2b84b" />
        <circle cx="284" cy="116" r="6.2" stroke="#10161a" stroke-width="1.1" fill="#eef0ec" />
        <circle cx="284" cy="116" r="2" fill="#3fc7b0" />
      </g>
      <g class="site-svg-seep">
        <circle cx="102" cy="152" r="1.8" fill="#10161a" fill-opacity="0.65" />
        <circle cx="150" cy="158" r="1.8" fill="#f2b84b" />
        <circle cx="198" cy="150" r="1.8" fill="#10161a" fill-opacity="0.65" />
        <circle cx="246" cy="156" r="1.8" fill="#f2b84b" />
        <circle cx="126" cy="64" r="1.8" fill="#10161a" fill-opacity="0.6" />
        <circle cx="174" cy="68" r="1.8" fill="#f2b84b" />
        <circle cx="222" cy="62" r="1.8" fill="#10161a" fill-opacity="0.6" />
      </g>
    </svg>`,

    // 04: 鑑定與放行（單峰粒徑分布曲線與標記點，不寫數值）
    `<svg class="site-plat-svg" data-svg-step="3" viewBox="0 0 360 225" fill="none" aria-hidden="true">
      <line x1="42" y1="184" x2="328" y2="184" stroke="#10161a" stroke-width="1.2" />
      <line x1="42" y1="36" x2="42" y2="184" stroke="#10161a" stroke-width="1.2" />
      <line x1="94" y1="184" x2="94" y2="190" stroke="#10161a" stroke-width="1" />
      <line x1="158" y1="184" x2="158" y2="190" stroke="#10161a" stroke-width="1" />
      <line x1="222" y1="184" x2="222" y2="190" stroke="#10161a" stroke-width="1" />
      <line x1="286" y1="184" x2="286" y2="190" stroke="#10161a" stroke-width="1" />
      <line x1="36" y1="138" x2="42" y2="138" stroke="#10161a" stroke-width="1" />
      <line x1="36" y1="92" x2="42" y2="92" stroke="#10161a" stroke-width="1" />
      <line x1="36" y1="46" x2="42" y2="46" stroke="#10161a" stroke-width="1" />
      <line x1="164" y1="46" x2="164" y2="184" stroke="#ff7a59" stroke-width="0.9" stroke-dasharray="3 3" />
      <path d="M52 183 C88 182, 114 176, 134 118 C148 76, 156 54, 164 54 C172 54, 182 82, 198 130 C216 172, 248 182, 314 183 Z"
            fill="#10161a" fill-opacity="0.06" />
      <path class="site-svg-curve"
            d="M52 183 C88 182, 114 176, 134 118 C148 76, 156 54, 164 54 C172 54, 182 82, 198 130 C216 172, 248 182, 314 183"
            stroke="#10161a" stroke-width="1.6" />
      <circle class="site-svg-pulse" cx="164" cy="54" r="4" fill="#ff7a59" />
      <circle cx="256" cy="64" r="14" stroke="#10161a" stroke-width="1" />
      <circle cx="256" cy="64" r="10.5" stroke="#10161a" stroke-width="0.6" stroke-opacity="0.45" />
      <circle cx="247" cy="54" r="2.2" fill="#f2b84b" />
      <circle cx="268" cy="58" r="2.2" fill="#3fc7b0" />
      <circle cx="258" cy="77" r="2.2" fill="#9b8cff" />
    </svg>`,
  ];
  return svgMarkup(svgs[index]);
}

/* Quality 互動外泌體剖面 SVG（不寫任何數值） */
function createQualitySvg() {
  // 產生繞圓一圈的雙層磷脂尾線
  const tails = [];
  const count = 48;
  const cx = 210;
  const cy = 210;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x1 = (cx + Math.cos(a) * 86).toFixed(1);
    const y1 = (cy + Math.sin(a) * 86).toFixed(1);
    const x2 = (cx + Math.cos(a) * 102).toFixed(1);
    const y2 = (cy + Math.sin(a) * 102).toFixed(1);
    tails.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3fc7b0" stroke-width="1.1" stroke-opacity="0.85" />`);
  }

  return svgMarkup(`
    <svg class="site-qc-svg" data-active="0" viewBox="0 0 420 420" fill="none" aria-hidden="true">
      <!-- 5. 安全：外圈保護與十字刻度 -->
      <g data-qc-part="safety">
        <circle cx="210" cy="210" r="186" stroke="#3fc7b0" stroke-width="1.25" stroke-dasharray="6 5" />
        <circle cx="210" cy="210" r="176" stroke="#3fc7b0" stroke-width="0.7" stroke-opacity="0.55" />
        <line x1="210" y1="14" x2="210" y2="30" stroke="#3fc7b0" stroke-width="1.3" />
        <line x1="210" y1="390" x2="210" y2="406" stroke="#3fc7b0" stroke-width="1.3" />
        <line x1="14" y1="210" x2="30" y2="210" stroke="#3fc7b0" stroke-width="1.3" />
        <line x1="390" y1="210" x2="406" y2="210" stroke="#3fc7b0" stroke-width="1.3" />
      </g>

      <!-- 4. 純度：周圍游離蛋白（在 active=4 時淡出）＋純淨區環 -->
      <g data-qc-part="free-proteins">
        <circle cx="72" cy="116" r="3" fill="#b88446" />
        <circle cx="88" cy="86" r="2.2" fill="#b88446" />
        <circle cx="58" cy="166" r="2.6" fill="#b88446" />
        <circle cx="64" cy="264" r="3" fill="#b88446" />
        <circle cx="102" cy="336" r="2.4" fill="#b88446" />
        <circle cx="348" cy="112" r="2.8" fill="#b88446" />
        <circle cx="362" cy="176" r="2.4" fill="#b88446" />
        <circle cx="352" cy="282" r="3" fill="#b88446" />
        <circle cx="308" cy="346" r="2.2" fill="#b88446" />
        <circle cx="246" cy="56" r="2.5" fill="#b88446" />
        <circle cx="164" cy="364" r="2.6" fill="#b88446" />
        <circle cx="148" cy="64" r="2.2" fill="#b88446" />
      </g>
      <g data-qc-part="purity-zone">
        <circle cx="210" cy="210" r="146" stroke="#9b8cff" stroke-width="1.2" stroke-dasharray="3 5" />
      </g>

      <!-- 3. 陰性：外部細胞碎片＋打叉 -->
      <g data-qc-part="debris">
        <polygon points="46,84 68,76 76,94 56,104" stroke="#eef0ec" stroke-width="1.15" fill="#eef0ec" fill-opacity="0.08" />
        <polygon points="336,318 362,310 370,334 344,342" stroke="#eef0ec" stroke-width="1.15" fill="#eef0ec" fill-opacity="0.08" />
        <polygon points="334,76 358,82 350,102 328,96" stroke="#eef0ec" stroke-width="1.15" fill="#eef0ec" fill-opacity="0.08" />
      </g>
      <g data-qc-part="debris-x">
        <path d="M44 74 L78 106 M78 74 L44 106" stroke="#ff7a59" stroke-width="1.8" />
        <path d="M332 308 L372 344 M372 308 L332 344" stroke="#ff7a59" stroke-width="1.8" />
        <path d="M326 72 L362 104 M362 72 L326 104" stroke="#ff7a59" stroke-width="1.8" />
      </g>

      <!-- 1. 形貌：脂雙層膜剖面 -->
      <g data-qc-part="bilayer">
        <circle cx="210" cy="210" r="106" stroke="#eef0ec" stroke-width="2" />
        <circle cx="210" cy="210" r="82" stroke="#eef0ec" stroke-width="1.6" />
        ${tails.join('')}
      </g>

      <!-- 2. 身分：四次跨膜蛋白（CD9 琥珀、CD63 玉、CD81 紫）＋腔內標記（珊瑚） -->
      <g data-qc-part="markers">
        <!-- CD9 琥珀（上方與右下） -->
        <path d="M196 124 L196 98 C196 86, 210 86, 210 98 L210 124 M218 124 L218 96 C218 82, 232 82, 232 96 L232 124"
              stroke="#f2b84b" stroke-width="2.1" stroke-linecap="round" />
        <circle cx="203" cy="89" r="3.2" fill="#f2b84b" />
        <circle cx="225" cy="86" r="3.2" fill="#f2b84b" />

        <!-- CD63 玉（右側） -->
        <path d="M292 194 L322 194 C334 194, 334 210, 322 210 L292 210 M292 218 L324 218 C336 218, 336 232, 324 232 L292 232"
              stroke="#3fc7b0" stroke-width="2.1" stroke-linecap="round" />
        <circle cx="330" cy="202" r="3.2" fill="#3fc7b0" />
        <circle cx="332" cy="225" r="3.2" fill="#3fc7b0" />

        <!-- CD81 紫（左下） -->
        <path d="M138 258 L112 274 C102 280, 110 294, 120 288 L146 272 M152 278 L128 296 C118 302, 128 314, 138 308 L162 290"
              stroke="#9b8cff" stroke-width="2.1" stroke-linecap="round" />
        <circle cx="110" cy="284" r="3.2" fill="#9b8cff" />
        <circle cx="127" cy="304" r="3.2" fill="#9b8cff" />

        <!-- 腔內蛋白 TSG101 / 貨物（珊瑚） -->
        <circle cx="188" cy="196" r="8" stroke="#ff7a59" stroke-width="1.8" />
        <circle cx="232" cy="224" r="7" stroke="#ff7a59" stroke-width="1.8" />
        <path d="M178 232 C192 222, 206 242, 222 234 C232 228, 240 218, 248 212"
              stroke="#ff7a59" stroke-width="1.8" stroke-linecap="round" />
      </g>

      <!-- 0. 大小：外徑標線（純幾何游標線，無任何數字） -->
      <g data-qc-part="size">
        <line x1="104" y1="210" x2="104" y2="356" stroke="#eef0ec" stroke-width="1" stroke-dasharray="3 3" />
        <line x1="316" y1="210" x2="316" y2="356" stroke="#eef0ec" stroke-width="1" stroke-dasharray="3 3" />
        <line x1="104" y1="346" x2="316" y2="346" stroke="#eef0ec" stroke-width="1.5" />
        <path d="M114 340 L104 346 L114 352" stroke="#eef0ec" stroke-width="1.5" />
        <path d="M306 340 L316 346 L306 352" stroke="#eef0ec" stroke-width="1.5" />
        <line x1="210" y1="341" x2="210" y2="351" stroke="#f2b84b" stroke-width="1.5" />
      </g>
    </svg>
  `);
}

/* About 成員抽象膜紋 SVG 頭像（不用人像） */
function createMembraneAvatar(index) {
  const variants = [
    `<svg class="site-about-avatar" viewBox="0 0 68 68" fill="none" aria-hidden="true">
      <circle cx="34" cy="34" r="32" stroke="#10161a" stroke-width="1" stroke-opacity="0.28" />
      <circle cx="34" cy="34" r="24" stroke="#10161a" stroke-width="1.1" />
      <circle cx="34" cy="34" r="17" stroke="#10161a" stroke-width="0.8" stroke-dasharray="3 3" />
      <circle cx="34" cy="34" r="9" stroke="#10161a" stroke-width="1" stroke-opacity="0.6" />
      <circle cx="51" cy="18" r="3" fill="#f2b84b" />
    </svg>`,
    `<svg class="site-about-avatar" viewBox="0 0 68 68" fill="none" aria-hidden="true">
      <circle cx="34" cy="34" r="32" stroke="#10161a" stroke-width="1" stroke-opacity="0.28" />
      <path d="M8 26 C20 18, 32 34, 44 26 C52 20, 58 24, 62 28" stroke="#10161a" stroke-width="1.1" />
      <path d="M6 36 C18 28, 30 44, 44 36 C54 30, 58 34, 62 38" stroke="#10161a" stroke-width="1.1" />
      <path d="M10 46 C22 38, 34 54, 46 46 C54 41, 58 44, 60 46" stroke="#10161a" stroke-width="0.8" stroke-opacity="0.55" />
      <circle cx="44" cy="26" r="3" fill="#3fc7b0" />
    </svg>`,
    `<svg class="site-about-avatar" viewBox="0 0 68 68" fill="none" aria-hidden="true">
      <circle cx="34" cy="34" r="32" stroke="#10161a" stroke-width="1" stroke-opacity="0.28" />
      <ellipse cx="34" cy="34" rx="25" ry="15" transform="rotate(-24 34 34)" stroke="#10161a" stroke-width="1.1" />
      <ellipse cx="34" cy="34" rx="25" ry="15" transform="rotate(24 34 34)" stroke="#10161a" stroke-width="0.85" stroke-opacity="0.6" />
      <circle cx="34" cy="34" r="6" stroke="#10161a" stroke-width="1" />
      <circle cx="21" cy="22" r="3" fill="#9b8cff" />
    </svg>`,
  ];
  return svgMarkup(variants[index % variants.length]);
}

function createArrowIcon() {
  return svgMarkup(`
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 11 L11 3 M5 3 L11 3 L11 9" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" />
    </svg>
  `);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function mountSite(root, opts = {}) {
  const seek = typeof opts.seek === 'function' ? opts.seek : () => {};
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('site', 'site--js');
  root.innerHTML = '';

  const smoothScrollTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  /* ─────────────────────────────────────────────────
   * 全站固定導覽列（建在 document.body 上的 <header>）
   * ───────────────────────────────────────────────── */
  const existingHeader = document.querySelector('header.site-nav');
  if (existingHeader) existingHeader.remove();

  let menuOpen = false;
  const navLinksMap = new Map();
  const drawerLinksMap = new Map();

  const toggleBtn = el('button', {
    type: 'button',
    class: 'site-nav__toggle',
    'aria-expanded': 'false',
    'aria-controls': 'site-nav-drawer',
    'aria-label': '開啟導覽選單',
  }, [
    el('span', { class: 'site-nav__bars', 'aria-hidden': 'true' }, [
      el('span', { class: 'site-nav__bar site-nav__bar--top' }),
      el('span', { class: 'site-nav__bar site-nav__bar--bot' }),
    ]),
  ]);

  const drawerList = el('ul', { class: 'site-nav__drawer-list' });
  const navList = el('ul', { class: 'site-nav__links' });

  const setMenuOpen = (open, restoreFocus = false) => {
    menuOpen = Boolean(open);
    toggleBtn.setAttribute('aria-expanded', String(menuOpen));
    toggleBtn.setAttribute('aria-label', menuOpen ? '關閉導覽選單' : '開啟導覽選單');
    drawer.classList.toggle('is-open', menuOpen);
    drawer.setAttribute('aria-hidden', String(!menuOpen));
    if (!menuOpen && restoreFocus) toggleBtn.focus();
  };

  nav.forEach((item, idx) => {
    const isLast = idx === nav.length - 1;
    const desktopLink = el('a', {
      href: `#${item.id}`,
      class: isLast ? 'site-nav__cta' : 'site-nav__link',
      text: item.label,
      onclick: (e) => {
        e.preventDefault();
        smoothScrollTo(item.id);
      },
    });
    navLinksMap.set(item.id, desktopLink);
    navList.append(el('li', {}, [desktopLink]));

    const mobileLink = el('a', {
      href: `#${item.id}`,
      class: isLast ? 'site-nav__drawer-cta' : 'site-nav__drawer-link',
      onclick: (e) => {
        e.preventDefault();
        setMenuOpen(false);
        smoothScrollTo(item.id);
      },
    }, isLast
      ? [item.label]
      : [el('span', { text: item.label }), el('span', { class: 'site-nav__drawer-dot', 'aria-hidden': 'true' })]);
    drawerLinksMap.set(item.id, mobileLink);
    drawerList.append(el('li', { class: 'site-nav__drawer-item' }, [mobileLink]));
  });

  const drawer = el('div', {
    id: 'site-nav-drawer',
    class: 'site-nav__drawer',
    'aria-hidden': 'true',
  }, [
    drawerList,
    brand.demoTag ? el('div', { class: 'site-nav__drawer-tag', text: brand.demoTag }) : null,
  ]);

  toggleBtn.addEventListener('click', () => setMenuOpen(!menuOpen));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      setMenuOpen(false, true);
    }
  });

  document.addEventListener('click', (e) => {
    if (menuOpen && !header.contains(e.target)) {
      setMenuOpen(false);
    }
  });

  const hasBrandEn = Boolean(brand.en && brand.en.trim());
  const brandBtn = el('button', {
    type: 'button',
    class: 'site-nav__brand',
    'aria-label': `${brand.zh} ${brand.en}`.trim(),
    onclick: () => {
      setMenuOpen(false);
      seek(0);
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    },
  }, [
    createBrandLogo('site-nav__logo'),
    el('span', { class: 'site-nav__zh', text: brand.zh }),
    hasBrandEn ? el('span', { class: 'site-nav__sep', 'aria-hidden': 'true' }) : null,
    hasBrandEn ? el('span', { class: 'site-nav__en', text: brand.en }) : null,
  ]);

  const header = el('header', { class: 'site-nav' }, [
    el('div', { class: 'site-nav__inner' }, [
      el('div', { class: 'site-nav__left' }, [
        brandBtn,
        brand.demoTag ? el('span', { class: 'site-nav__tag', text: brand.demoTag }) : null,
      ]),
      el('nav', { 'aria-label': brand.zh }, [navList]),
      toggleBtn,
    ]),
    drawer,
  ]);

  document.body.appendChild(header);

  /* ─────────────────────────────────────────────────
   * 1. PLATFORM 技術平台
   * ───────────────────────────────────────────────── */
  const platStageCode = el('span', { text: `${platform.items[0].no} ${platform.items[0].name}` });
  const platSvgs = platform.items.map((_, i) => createPlatformSvg(i));
  platSvgs[0].classList.add('is-active');

  const platStage = el('div', { class: 'site-plat-stage', 'data-step': '0' }, [
    el('div', { class: 'site-plat-stage-head' }, [
      el('span', { class: 'site-plat-stage-code' }, [
        el('span', { class: 'site-plat-stage-dot', 'aria-hidden': 'true' }),
        platStageCode,
      ]),
    ]),
    el('div', { class: 'site-plat-canvas' }, platSvgs),
  ]);

  const platRows = [];
  const setActivePlatform = (idx) => {
    platStage.setAttribute('data-step', String(idx));
    const item = platform.items[idx];
    platStageCode.textContent = `${item.no} ${item.name}`;
    platSvgs.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    platRows.forEach((r, i) => r.classList.toggle('is-active', i === idx));
  };

  const platList = el('div', { class: 'site-plat-right' },
    platform.items.map((item, idx) => {
      const mobileSvgWrap = el('div', { class: 'site-plat-mobile-svg' }, [
        createPlatformSvg(idx),
      ]);
      const btn = el('button', {
        type: 'button',
        class: 'site-plat-btn',
        'aria-label': `${item.no} ${item.name}`,
        onclick: () => {
          setActivePlatform(idx);
          seek(item.jump);
        },
        onfocus: () => setActivePlatform(idx),
      }, [
        el('span', { class: 'site-plat-no', text: item.no, 'aria-hidden': 'true' }),
        el('span', { class: 'site-plat-body' }, [
          el('span', { class: 'site-plat-name', text: item.name }),
          el('span', { class: 'site-plat-expand' }, [
            el('span', { class: 'site-plat-expand-inner' }, [
              el('span', { class: 'site-plat-text', text: item.text }),
              mobileSvgWrap,
            ]),
          ]),
        ]),
        el('span', { class: 'site-plat-arrow', 'aria-hidden': 'true' }, [createArrowIcon()]),
      ]);

      const row = el('div', {
        class: `site-plat-row site-reveal${idx === 0 ? ' is-active' : ''}`,
        'data-index': String(idx),
        onmouseenter: () => setActivePlatform(idx),
      }, [btn]);
      platRows.push(row);
      return row;
    })
  );

  const platformSec = el('section', { id: 'platform', class: 'site-sec site-sec--first' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-grid' }, [
        el('div', { class: 'site-plat-left' }, [
          el('div', { class: 'site-plat-sticky' }, [
            el('h2', { class: 'site-h2 site-reveal', text: platform.title }),
            el('p', { class: 'site-lead site-reveal', text: platform.lead }),
            platStage,
          ]),
        ]),
        platList,
      ]),
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 2. SERVICES 合作方案（真 <table> + 整欄亮起 + 手機單欄切換）
   * ───────────────────────────────────────────────── */
  const srvTable = el('table', { class: 'site-srv-table', 'data-mobile-col': '1' });

  const srvTabs = el('div', { class: 'site-srv-tabs', role: 'tablist', 'aria-label': services.title });
  const srvTabButtons = [];
  const selectMobileCol = (colIdx) => {
    srvTable.setAttribute('data-mobile-col', String(colIdx));
    srvTabButtons.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i + 1 === colIdx));
    });
  };

  for (let c = 1; c < services.cols.length; c++) {
    const tabBtn = el('button', {
      type: 'button',
      role: 'tab',
      class: 'site-srv-tab',
      'aria-selected': c === 1 ? 'true' : 'false',
      text: services.cols[c],
      onclick: () => selectMobileCol(c),
    });
    srvTabButtons.push(tabBtn);
    srvTabs.append(tabBtn);
  }

  const srvTheadRow = el('tr', {},
    services.cols.map((colTitle, cIdx) => {
      if (cIdx === 0) return el('th', { scope: 'col', text: colTitle });
      return el('th', {
        scope: 'col',
        'data-col': String(cIdx),
        onmouseenter: () => srvTable.setAttribute('data-hover-col', String(cIdx)),
        onmouseleave: () => srvTable.removeAttribute('data-hover-col'),
      }, [
        el('span', { class: `site-srv-col-mark site-srv-col-mark--${cIdx}`, 'aria-hidden': 'true' }),
        colTitle,
      ]);
    })
  );

  const srvTbody = el('tbody', {},
    services.rows.map((rowData) => el('tr', {},
      rowData.map((cell, cIdx) => {
        if (cIdx === 0) return el('th', { scope: 'row', text: cell });
        return el('td', {
          'data-col': String(cIdx),
          text: cell,
          onmouseenter: () => srvTable.setAttribute('data-hover-col', String(cIdx)),
          onmouseleave: () => srvTable.removeAttribute('data-hover-col'),
        });
      })
    ))
  );

  srvTable.append(el('thead', {}, [srvTheadRow]), srvTbody);

  const servicesSec = el('section', { id: 'services', class: 'site-sec' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-srv-head' }, [
        el('h2', { class: 'site-h2 site-reveal', text: services.title }),
      ]),
      srvTabs,
      el('div', { class: 'site-srv-table-wrap site-reveal' }, [srvTable]),
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 3. QUALITY 品質鑑定（深色反白 + 逐列畫線 + 互動外泌體剖面）
   * ───────────────────────────────────────────────── */
  const qcSvg = createQualitySvg();
  const qcCapTitle = el('span', { text: quality.rows[0][0] });
  const qcCapSub = el('span', { class: 'site-qc-diagram-sub', text: quality.rows[0][2] });
  const qcRowNodes = [];

  const setActiveQc = (idx) => {
    qcSvg.setAttribute('data-active', String(idx));
    qcCapTitle.textContent = quality.rows[idx][0];
    qcCapSub.textContent = quality.rows[idx][2];
    qcRowNodes.forEach((tr, i) => tr.classList.toggle('is-active', i === idx));
  };

  const qcTable = el('table', { class: 'site-qc-table' }, [
    el('thead', {}, [
      el('tr', {}, quality.cols.map((c) => el('th', { scope: 'col', text: c }))),
    ]),
    el('tbody', {},
      quality.rows.map((rowData, idx) => {
        const tr = el('tr', {
          class: `site-qc-row${idx === 0 ? ' is-active' : ''}`,
          'data-qc': String(idx),
          tabindex: '0',
          style: `--qc-delay:${idx * 75}ms`,
          onmouseenter: () => setActiveQc(idx),
          onfocus: () => setActiveQc(idx),
          onclick: () => setActiveQc(idx),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveQc(idx);
            }
          },
        }, [
          el('td', { class: 'site-qc-q' }, [
            el('span', { class: 'site-qc-q-wrap' }, [
              el('span', { class: 'site-qc-pip', 'aria-hidden': 'true' }),
              el('span', { text: rowData[0] }),
            ]),
          ]),
          el('td', { class: 'site-qc-method', text: rowData[1] }),
          el('td', { class: 'site-qc-what', text: rowData[2] }),
        ]);
        qcRowNodes.push(tr);
        return tr;
      })
    ),
  ]);

  const qualitySec = el('section', { id: 'quality', class: 'site-sec site-sec--dark' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-grid' }, [
        el('div', { class: 'site-qc-head' }, [
          el('h2', { class: 'site-h2 site-reveal', text: quality.title }),
          el('p', { class: 'site-lead site-reveal', text: quality.lead }),
        ]),
        el('div', { class: 'site-qc-left' }, [qcTable]),
        el('div', { class: 'site-qc-right' }, [
          el('div', { class: 'site-qc-diagram-wrap site-reveal' }, [
            el('div', { class: 'site-qc-diagram-caption' }, [qcCapTitle, qcCapSub]),
            qcSvg,
          ]),
        ]),
      ]),
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 4. PROCESS 合作流程（五顆囊泡＋捲動珍珠前進）
   * ───────────────────────────────────────────────── */
  const procStepNodes = [];
  const procStage = el('div', { class: 'site-proc-stage', style: '--proc-p:0' }, [
    el('div', { class: 'site-proc-rail', 'aria-hidden': 'true' }, [
      el('div', { class: 'site-proc-rail-fill' }),
      el('div', { class: 'site-proc-pearl' }),
    ]),
    el('ol', { class: 'site-proc-list' },
      processData.steps.map((step, idx) => {
        const li = el('li', { class: 'site-proc-step site-reveal' }, [
          el('span', { class: 'site-proc-vesicle', 'aria-hidden': 'true' }),
          el('div', { class: 'site-proc-copy' }, [
            el('div', { class: 'site-proc-num', text: String(idx + 1).padStart(2, '0') }),
            el('h3', { class: 'site-proc-name', text: step.name }),
            el('p', { class: 'site-proc-text', text: step.text }),
          ]),
        ]);
        procStepNodes.push(li);
        return li;
      })
    ),
  ]);

  const processSec = el('section', { id: 'process', class: 'site-sec' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-proc-head' }, [
        el('h2', { class: 'site-h2 site-reveal', text: processData.title }),
      ]),
      procStage,
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 5. ABOUT 關於我們
   * ───────────────────────────────────────────────── */
  const isPlaceholderText = (str) => typeof str === 'string' && str.includes('待填');

  const aboutSec = el('section', { id: 'about', class: 'site-sec' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-grid' }, [
        el('div', { class: 'site-about-top' }, [
          el('h2', { class: 'site-about-title site-reveal', text: about.title }),
          el('p', { class: 'site-about-manifesto site-reveal', text: about.text }),
        ]),
        el('div', { class: 'site-about-team' },
          about.people.map((person, idx) => el('article', { class: 'site-about-person site-reveal' }, [
            createMembraneAvatar(idx),
            el('div', { class: 'site-about-role', text: person.role }),
            el('h3', {
              class: `site-about-name${isPlaceholderText(person.name) ? ' is-placeholder' : ''}`,
              text: person.name,
            }),
            el('p', {
              class: `site-about-bio${isPlaceholderText(person.text) ? ' is-placeholder' : ''}`,
              text: person.text,
            }),
          ]))
        ),
        el('p', { class: 'site-about-reg site-reveal', text: about.regulatory }),
      ]),
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 6. CONTACT 合作洽詢（純文字複製，不送任何網路請求）
   * ───────────────────────────────────────────────── */
  const fieldInputs = new Map();
  const fieldErrors = new Map();
  const requiredIds = new Set(['org', 'name']);

  const statusLive = el('span', { class: 'site-form-status', role: 'status', 'aria-live': 'polite' });
  const fallbackBox = el('textarea', {
    class: 'site-copy-box',
    readonly: true,
    'aria-label': contact.button,
  });
  const fallbackWrap = el('div', { class: 'site-copy-fallback' }, [fallbackBox]);

  const form = el('form', { class: 'site-form', novalidate: true }, [
    ...contact.fields.map((field) => {
      const inputId = `site-field-${field.id}`;
      const errId = `site-err-${field.id}`;
      const isReq = requiredIds.has(field.id);

      let control;
      if (field.type === 'select') {
        control = el('select', { id: inputId, name: field.id, class: 'site-select' },
          (field.options || []).map((opt) => el('option', { value: opt, text: opt }))
        );
      } else if (field.type === 'textarea') {
        control = el('textarea', { id: inputId, name: field.id, class: 'site-textarea', rows: '4' });
      } else {
        control = el('input', {
          id: inputId,
          name: field.id,
          type: field.type || 'text',
          class: 'site-input',
          required: isReq,
          'aria-required': isReq ? 'true' : null,
          'aria-describedby': isReq ? errId : null,
        });
      }

      const errEl = isReq ? el('span', { id: errId, class: 'site-field-err', role: 'alert' }) : null;
      if (isReq) {
        control.addEventListener('input', () => {
          if (control.value.trim()) {
            control.removeAttribute('aria-invalid');
            errEl.textContent = '';
          }
        });
        fieldErrors.set(field.id, errEl);
      }
      fieldInputs.set(field.id, { control, field });

      return el('div', { class: 'site-field' }, [
        el('label', { for: inputId, class: 'site-label' }, [
          field.label,
          isReq ? el('span', { class: 'site-req-dot', 'aria-hidden': 'true' }) : null,
        ]),
        control,
        errEl,
      ]);
    }),
    el('div', { class: 'site-form-actions' }, [
      el('button', { type: 'submit', class: 'site-submit', text: contact.button }),
      statusLive,
    ]),
    fallbackWrap,
    el('p', { class: 'site-form-note', text: contact.demoNote }),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusLive.textContent = '';
    fallbackWrap.classList.remove('is-visible');

    let firstInvalid = null;
    for (const reqId of requiredIds) {
      const entry = fieldInputs.get(reqId);
      const errEl = fieldErrors.get(reqId);
      if (!entry) continue;
      if (!entry.control.value.trim()) {
        entry.control.setAttribute('aria-invalid', 'true');
        if (errEl) errEl.textContent = `請填寫${entry.field.label}`;
        if (!firstInvalid) firstInvalid = entry.control;
      } else {
        entry.control.removeAttribute('aria-invalid');
        if (errEl) errEl.textContent = '';
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const lines = [`${brand.zh} ${brand.en}`.trim()];
    for (const field of contact.fields) {
      const val = fieldInputs.get(field.id).control.value.trim();
      lines.push(`${field.label}：${val || '—'}`);
    }
    const summaryText = lines.join('\n');

    let copiedOk = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(summaryText);
        copiedOk = true;
      }
    } catch {
      copiedOk = false;
    }

    fallbackBox.value = summaryText;
    fallbackWrap.classList.add('is-visible');
    if (copiedOk) {
      statusLive.textContent = contact.copied;
    } else {
      statusLive.textContent = '已產生需求摘要，可直接選取複製';
      fallbackBox.focus();
      fallbackBox.select();
    }
  });

  const contactInfo = el('dl', { class: 'site-contact-info site-reveal' },
    contact.info.map(([k, v]) => el('div', { class: 'site-info-item' }, [
      el('dt', { class: 'site-info-dt', text: k }),
      el('dd', {
        class: `site-info-dd${isPlaceholderText(v) ? ' is-placeholder' : ''}`,
        text: v,
      }),
    ]))
  );

  const contactSec = el('section', { id: 'contact', class: 'site-sec' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-grid' }, [
        el('div', { class: 'site-contact-left' }, [
          el('h2', { class: 'site-h2 site-reveal', text: contact.title }),
          el('p', { class: 'site-lead site-reveal', text: contact.lead }),
        ]),
        el('div', { class: 'site-contact-right site-reveal' }, [form]),
        contactInfo,
      ]),
    ]),
  ]);

  /* ─────────────────────────────────────────────────
   * 7. FOOTER 頁尾
   * ───────────────────────────────────────────────── */
  const footerEl = el('footer', { class: 'site-footer' }, [
    el('div', { class: 'site-wrap' }, [
      el('div', { class: 'site-footer-top' }, [
        el('a', {
          href: '#platform',
          class: 'site-footer-brand',
          onclick: (e) => {
            e.preventDefault();
            seek(0);
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
          },
        }, [
          createBrandLogo('site-nav__logo'),
          el('span', { class: 'site-nav__zh', text: brand.zh }),
          hasBrandEn ? el('span', { class: 'site-nav__sep', 'aria-hidden': 'true' }) : null,
          hasBrandEn ? el('span', { class: 'site-nav__en', text: brand.en }) : null,
        ]),
        el('ul', { class: 'site-footer-nav' },
          nav.map((item) => el('li', {}, [
            el('a', {
              href: `#${item.id}`,
              class: 'site-footer-link',
              text: item.label,
              onclick: (e) => {
                e.preventDefault();
                smoothScrollTo(item.id);
              },
            }),
          ]))
        ),
      ]),
      el('div', { class: 'site-footer-bot' }, [
        el('p', { class: 'site-footer-note', text: footer.note }),
      ]),
    ]),
  ]);

  root.append(platformSec, servicesSec, qualitySec, processSec, aboutSec, contactSec, footerEl);

  /* ─────────────────────────────────────────────────
   * 導覽列目前區塊標示（IntersectionObserver）
   * ───────────────────────────────────────────────── */
  let currentInSite = false;
  let currentTheme = 0;
  let lastObservedId = null;

  const sectionIds = nav.map((n) => n.id);
  const setCurrentNav = (activeId) => {
    for (const id of sectionIds) {
      const isAct = currentInSite && id === activeId;
      const dLink = navLinksMap.get(id);
      const mLink = drawerLinksMap.get(id);
      if (dLink) {
        if (isAct) dLink.setAttribute('aria-current', 'location');
        else dLink.removeAttribute('aria-current');
      }
      if (mLink) {
        if (isAct) mLink.setAttribute('aria-current', 'location');
        else mLink.removeAttribute('aria-current');
      }
    }
  };

  if ('IntersectionObserver' in window) {
    const visibleRatios = new Map();
    const navObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      let bestId = null;
      let bestRatio = 0;
      for (const id of sectionIds) {
        const r = visibleRatios.get(id) || 0;
        if (r > bestRatio) {
          bestRatio = r;
          bestId = id;
        }
      }
      if (bestId) {
        lastObservedId = bestId;
        setCurrentNav(bestId);
      }
    }, {
      rootMargin: '-25% 0px -45% 0px',
      threshold: [0, 0.15, 0.35, 0.6],
    });

    for (const id of sectionIds) {
      const sec = document.getElementById(id);
      if (sec) navObserver.observe(sec);
    }
  }

  /* ─────────────────────────────────────────────────
   * 進場動畫（觸發一次；prefers-reduced-motion 直接顯示）
   * ───────────────────────────────────────────────── */
  if (!reducedMotion && 'IntersectionObserver' in window) {
    root.classList.add('site--anim');
    const reveals = root.querySelectorAll('.site-reveal');
    const vh = window.innerHeight || 800;

    const revealObserver = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-pending');
          obs.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

    reveals.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top > vh * 0.96) {
        node.classList.add('is-pending');
        revealObserver.observe(node);
      }
    });

    // Quality 表格捲入時逐列畫線
    const qcRect = qcTable.getBoundingClientRect();
    if (qcRect.top > vh * 0.96) {
      qcTable.classList.add('is-pending');
      const qcObs = new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            qcTable.classList.remove('is-pending');
            obs.unobserve(entry.target);
          }
        }
      }, { threshold: 0.12 });
      qcObs.observe(qcTable);
    }
  }

  /* ─────────────────────────────────────────────────
   * Process 捲動驅動珍珠沿線前進（精準對齊首尾囊泡圓心）
   * ───────────────────────────────────────────────── */
  const procVesicles = procStepNodes.map((li) => li.querySelector('.site-proc-vesicle'));
  const syncProcessRail = () => {
    if (procVesicles.length < 2) return;
    const stageRect = procStage.getBoundingClientRect();
    const firstRect = procVesicles[0].getBoundingClientRect();
    const lastRect = procVesicles[procVesicles.length - 1].getBoundingClientRect();
    if (stageRect.width <= 0) return;

    const firstCx = firstRect.left + firstRect.width / 2 - stageRect.left;
    const lastCx = lastRect.left + lastRect.width / 2 - stageRect.left;
    const firstCy = firstRect.top + firstRect.height / 2 - stageRect.top;
    const lastCy = lastRect.top + lastRect.height / 2 - stageRect.top;

    procStage.style.setProperty('--rail-start', `${firstCx.toFixed(1)}px`);
    procStage.style.setProperty('--rail-len', `${Math.max(0, lastCx - firstCx).toFixed(1)}px`);
    procStage.style.setProperty('--rail-v-start', `${firstCy.toFixed(1)}px`);
    procStage.style.setProperty('--rail-v-len', `${Math.max(0, lastCy - firstCy).toFixed(1)}px`);
  };

  let procRaf = 0;
  const updateProcessPearl = () => {
    procRaf = 0;
    syncProcessRail();
    const rect = procStage.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const start = vh * 0.82;
    const end = vh * 0.28;
    const raw = (start - rect.top) / (start - end + rect.height * 0.45);
    const p = reducedMotion ? 1 : clamp(raw, 0, 1);

    procStage.style.setProperty('--proc-p', p.toFixed(4));
    const stepCount = procStepNodes.length;
    const activeIdx = Math.min(stepCount - 1, Math.round(p * (stepCount - 1)));
    procStepNodes.forEach((li, i) => {
      const threshold = i / (stepCount - 1);
      li.classList.toggle('is-passed', p >= threshold - 0.03);
      li.classList.toggle('is-current', i === activeIdx && p > 0.02);
    });
  };

  const onProcScroll = () => {
    if (!procRaf) procRaf = window.requestAnimationFrame(updateProcessPearl);
  };
  window.addEventListener('scroll', onProcScroll, { passive: true });
  window.addEventListener('resize', onProcScroll, { passive: true });
  updateProcessPearl();

  /* ─────────────────────────────────────────────────
   * 外部控制 API：setTheme(0..1) / setInSite(bool)
   * ───────────────────────────────────────────────── */
  const applyThemeVars = (t) => {
    const k = clamp(Number(t) || 0, 0, 1);
    currentTheme = k;
    if (currentInSite) return;
    // 0: 亮字 #eef0ec (238,240,236)，1: 深字 #10161a (16,22,26)
    const fr = lerp(238, 16, k);
    const fg = lerp(240, 22, k);
    const fb = lerp(236, 26, k);
    const ir = lerp(16, 238, k);
    const ig = lerp(22, 240, k);
    const ib = lerp(26, 236, k);
    header.style.setProperty('--sn-fg-r', String(fr));
    header.style.setProperty('--sn-fg-g', String(fg));
    header.style.setProperty('--sn-fg-b', String(fb));
    header.style.setProperty('--sn-inv-r', String(ir));
    header.style.setProperty('--sn-inv-g', String(ig));
    header.style.setProperty('--sn-inv-b', String(ib));
  };

  const setInSite = (inSite) => {
    currentInSite = Boolean(inSite);
    header.classList.toggle('site-nav--solid', currentInSite);
    if (!currentInSite) {
      applyThemeVars(currentTheme);
      setCurrentNav(null);
    } else {
      header.style.removeProperty('--sn-fg-r');
      header.style.removeProperty('--sn-fg-g');
      header.style.removeProperty('--sn-fg-b');
      header.style.removeProperty('--sn-inv-r');
      header.style.removeProperty('--sn-inv-g');
      header.style.removeProperty('--sn-inv-b');
      if (lastObservedId) setCurrentNav(lastObservedId);
    }
  };

  applyThemeVars(0);

  return {
    setTheme: applyThemeVars,
    setInSite,
  };
}
