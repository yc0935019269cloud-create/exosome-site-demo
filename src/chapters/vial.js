// 最終章：亮場產品攝影級血清瓶（crimp vial），隨組規格器即時反應
import * as THREE from 'three';
import { brand, config } from '../content.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;

// 降飽和、霧面醫藥級塑膠翻蓋色（琥珀 / 玉 / 長春花紫）
const CAP_COLORS = {
  research: new THREE.Color('#c9a25e'),
  ingredient: new THREE.Color('#639e92'),
  process: new THREE.Color('#847eb8'),
};

// ─── 程式產生攝影棚柔光箱環境（全亮場無任何暗片，純羽化直條柔光箱與頂棚柔光） ───
function createStudioEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#f1f3ef');

  const domeGeo = new THREE.SphereGeometry(24, 48, 32);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        vec3 d = vDir / max(length(vDir), 1e-5);
        float h = d.y * 0.5 + 0.5;
        float xzLen = length(d.xz);
        float az = xzLen > 1e-4 ? atan(d.x, d.z) : 0.0;

        // 全域均勻明亮珍珠白攝影棚基底（徹底移除所有暗塊／黑旗，避免瓶肩灰黑反射）
        vec3 bot = vec3(0.84, 0.87, 0.85);
        vec3 mid = vec3(0.94, 0.96, 0.94);
        vec3 top = vec3(1.03, 1.04, 1.03);
        vec3 col = mix(bot, mid, smoothstep(0.15, 0.50, h));
        col = mix(col, top, smoothstep(0.50, 0.92, h));

        // 左前主長條柔光箱（直條柔美高光帶，貫穿瓶身與鋁蓋）
        float strip1A = exp(-pow(max(abs(az + 0.66), 0.0) / 0.13, 2.0));
        float strip1V = smoothstep(-0.55, -0.18, d.y) * (1.0 - smoothstep(0.55, 0.86, d.y));
        col += vec3(3.4, 3.45, 3.42) * strip1A * strip1V;

        // 右前細長副柔光條（銳利垂直玻璃與金屬高光線）
        float strip2A = exp(-pow(max(abs(az - 0.84), 0.0) / 0.072, 2.0));
        float strip2V = smoothstep(-0.50, -0.15, d.y) * (1.0 - smoothstep(0.52, 0.84, d.y));
        col += vec3(2.9, 2.98, 3.04) * strip2A * strip2V;

        // 棚頂圓形柔光箱（勾勒瓶肩弧面與翻蓋頂部）
        float overhead = smoothstep(0.68, 0.95, d.y);
        col += vec3(2.0, 2.04, 2.05) * overhead;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));

  const rt = pmrem.fromScene(envScene, 0.018);
  domeGeo.dispose();
  domeMat.dispose();
  pmrem.dispose();
  return rt.texture;
}

// ─── 程式產生地面深貼接觸影＋厚玻璃瓶底折射焦散亮斑 ───
function createFloorShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  // 柔和攝影棚拖影
  const gWide = ctx.createRadialGradient(270, 242, 34, 270, 242, 212);
  gWide.addColorStop(0.0, 'rgba(14, 22, 28, 0.28)');
  gWide.addColorStop(0.32, 'rgba(14, 22, 28, 0.14)');
  gWide.addColorStop(0.68, 'rgba(14, 22, 28, 0.035)');
  gWide.addColorStop(1.0, 'rgba(14, 22, 28, 0)');
  ctx.fillStyle = gWide;
  ctx.fillRect(0, 0, 512, 512);

  // 緊貼厚玻璃底緣的深色接觸陰影環
  const gContact = ctx.createRadialGradient(256, 256, 36, 256, 256, 118);
  gContact.addColorStop(0.0, 'rgba(12, 20, 26, 0.10)');
  gContact.addColorStop(0.50, 'rgba(10, 18, 24, 0.56)');
  gContact.addColorStop(0.72, 'rgba(12, 20, 26, 0.34)');
  gContact.addColorStop(0.88, 'rgba(14, 22, 28, 0.08)');
  gContact.addColorStop(1.0, 'rgba(14, 22, 28, 0)');
  ctx.fillStyle = gContact;
  ctx.beginPath();
  ctx.arc(256, 256, 120, 0, Math.PI * 2);
  ctx.fill();

  // 瓶底厚玻璃中央微焦散亮斑
  ctx.globalCompositeOperation = 'lighter';
  const gCaustic = ctx.createRadialGradient(264, 252, 4, 264, 252, 58);
  gCaustic.addColorStop(0.0, 'rgba(255, 255, 252, 0.42)');
  gCaustic.addColorStop(0.55, 'rgba(235, 248, 244, 0.16)');
  gCaustic.addColorStop(1.0, 'rgba(235, 248, 244, 0)');
  ctx.fillStyle = gCaustic;
  ctx.beginPath();
  ctx.arc(264, 252, 60, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── 鋁蓋高解析細拉絲＋密集捲邊壓痕貼圖（bump + roughness） ───
function createAluminumTextures() {
  const w = 1024;
  const h = 512;
  const bumpC = document.createElement('canvas');
  bumpC.width = w;
  bumpC.height = h;
  const bctx = bumpC.getContext('2d');
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  const roughC = document.createElement('canvas');
  roughC.width = w;
  roughC.height = h;
  const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, w, h);

  let seed = 9012;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < h; y++) {
    const v = 120 + Math.sin(y * 2.4) * 6 + Math.cos(y * 7.1) * 5 + (rand() - 0.5) * 14;
    const bv = clamp(Math.round(v), 70, 185);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(0, y, w, 1);

    const rv = clamp(Math.round(62 + (rand() - 0.5) * 28 + Math.sin(y * 3.1) * 8), 38, 108);
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(0, y, w, 1);
  }

  bctx.fillStyle = 'rgba(34,34,34,0.62)';
  bctx.fillRect(0, 84, w, 12);
  bctx.fillStyle = 'rgba(220,220,220,0.45)';
  bctx.fillRect(0, 96, w, 6);

  const pleats = 56;
  const pw = w / pleats;
  for (let i = 0; i < pleats; i++) {
    const x = i * pw;
    const g = bctx.createLinearGradient(x, 0, x + pw, 0);
    g.addColorStop(0.0, 'rgba(232,232,232,0.58)');
    g.addColorStop(0.45, 'rgba(32,32,32,0.68)');
    g.addColorStop(0.55, 'rgba(32,32,32,0.68)');
    g.addColorStop(1.0, 'rgba(232,232,232,0.58)');
    bctx.fillStyle = g;
    bctx.fillRect(x, 326, pw, 186);

    rctx.fillStyle = 'rgba(115,115,115,0.28)';
    rctx.fillRect(x + pw * 0.35, 330, pw * 0.3, 180);
  }

  const bump = new THREE.CanvasTexture(bumpC);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;

  const rough = new THREE.CanvasTexture(roughC);
  rough.wrapS = THREE.RepeatWrapping;
  rough.wrapT = THREE.ClampToEdgeWrapping;

  return { bump, rough };
}

// ─── 純白偏冷多孔凍乾餅貼圖（高對比細孔＋微乾燥裂紋 bump 與冷白粉質 albedo） ───
function createLyoTextures() {
  const size = 512;
  const bumpC = document.createElement('canvas');
  bumpC.width = size;
  bumpC.height = size;
  const bctx = bumpC.getContext('2d');
  bctx.fillStyle = '#a4a4a4';
  bctx.fillRect(0, 0, size, size);

  const albC = document.createElement('canvas');
  albC.width = size;
  albC.height = size;
  const actx = albC.getContext('2d');
  // 純白粉質基底（中性白、不偏藍不發黃）
  actx.fillStyle = '#f5f6f3';
  actx.fillRect(0, 0, size, size);

  let seed = 2471;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 細微粉體顆粒起伏與粉塊明暗
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.5;
    const bright = rand() > 0.45;
    bctx.fillStyle = bright
      ? `rgba(245,245,245,${(0.22 + rand() * 0.28).toFixed(2)})`
      : `rgba(56,56,56,${(0.20 + rand() * 0.28).toFixed(2)})`;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();

    if (i % 3 === 0) {
      actx.fillStyle = bright
        ? `rgba(255,255,255,${(0.18 + rand() * 0.22).toFixed(2)})`
        : `rgba(206,210,212,${(0.14 + rand() * 0.18).toFixed(2)})`;
      actx.beginPath();
      actx.arc(x, y, r * 1.15, 0, Math.PI * 2);
      actx.fill();
    }
  }

  // 冷凍昇華留下的細密多孔洞（清晰中性灰深凹孔＋微亮粉質孔緣）
  for (let i = 0; i < 1150; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.4 + Math.pow(rand(), 2.0) * 5.6;
    bctx.fillStyle = `rgba(12,12,12,${(0.58 + rand() * 0.36).toFixed(2)})`;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();

    actx.fillStyle = `rgba(146,152,158,${(0.38 + rand() * 0.36).toFixed(2)})`;
    actx.beginPath();
    actx.arc(x, y, r * 0.94, 0, Math.PI * 2);
    actx.fill();

    if (r > 3.2) {
      actx.strokeStyle = 'rgba(255,255,255,0.52)';
      actx.lineWidth = 0.9;
      actx.beginPath();
      actx.arc(x - 0.6, y - 0.6, r * 0.95, 0, Math.PI * 2);
      actx.stroke();
    }
  }

  // 乾燥收縮造成的纖細微裂紋（branching micro-fissures）
  for (let c = 0; c < 22; c++) {
    let x = rand() * size;
    let y = rand() * size;
    let ang = rand() * Math.PI * 2;
    const segs = 6 + Math.floor(rand() * 8);
    bctx.strokeStyle = `rgba(10,10,10,${(0.72 + rand() * 0.24).toFixed(2)})`;
    bctx.lineWidth = 1.2 + rand() * 1.2;
    bctx.beginPath();
    bctx.moveTo(x, y);

    actx.strokeStyle = `rgba(134,142,148,${(0.48 + rand() * 0.32).toFixed(2)})`;
    actx.lineWidth = 1.1 + rand() * 1.0;
    actx.beginPath();
    actx.moveTo(x, y);

    for (let s = 0; s < segs; s++) {
      ang += (rand() - 0.5) * 0.85;
      const len = 7 + rand() * 14;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      bctx.lineTo(x, y);
      actx.lineTo(x, y);
    }
    bctx.stroke();
    actx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpC);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3, 1.6);

  const map = new THREE.CanvasTexture(albC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1.6);

  return { bump, map };
}

// ─── 霧面塑膠翻蓋細咬花貼圖 ───
function createMattePlasticBump() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  let seed = 7711;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 4500; i++) {
    const v = 104 + Math.round(rand() * 48);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * 256, rand() * 256, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// ─── 瓶身標籤 CanvasTexture（2048×918、anisotropy 開滿、文字區正中對齊鏡頭、規格碼再大 1.3×） ───
function createLabelController(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 918;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function draw(cfg) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5; // 1024：正對鏡頭的圓柱正中央
    const padX = 290;
    const innerW = w - padX * 2;

    // 實驗室霧面標籤紙底（微降亮度避免強光過曝沖淡細字）
    ctx.fillStyle = '#f2f3ef';
    ctx.fillRect(0, 0, w, h);

    // 極細紙張纖維線
    ctx.fillStyle = 'rgba(16, 22, 26, 0.016)';
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 2);
    }

    // 上下細壓邊線
    ctx.fillStyle = 'rgba(12, 18, 22, 0.26)';
    ctx.fillRect(0, 24, w, 3);
    ctx.fillRect(0, h - 27, w, 3);

    // ── 第一列：品牌圓膜三點標誌＋brand（左） / DEMO（右），對稱排於正面可見弧內 ──
    const lx = padX + 26;
    const ly = 114;
    ctx.strokeStyle = '#0c1216';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.arc(lx, ly, 23, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0c1216';
    for (const [dx, dy, r] of [[-6.8, -5.8, 3.8], [7.8, -3.4, 3.2], [-1, 7.6, 3.5]]) {
      ctx.beginPath();
      ctx.arc(lx + dx, ly + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#0c1216';
    ctx.font = '600 60px "Schibsted Grotesk", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(brand.en || brand.zh, lx + 42, ly + 2);

    ctx.font = '600 40px "Schibsted Grotesk", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(12, 18, 22, 0.72)';
    ctx.textAlign = 'right';
    ctx.fillText('DEMO', w - padX, ly + 2);

    // 上分隔細線
    ctx.strokeStyle = 'rgba(12, 18, 22, 0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padX, 182);
    ctx.lineTo(w - padX, 182);
    ctx.stroke();

    // ── 第二列：超醒目主規格碼（212px，較前版 162px 放大 1.31×）＋用途色點，整體精準置中 ──
    const codeText = cfg.code || 'UC-LY-I';
    ctx.font = '600 212px "Schibsted Grotesk", system-ui, sans-serif';
    const codeW = ctx.measureText(codeText).width;
    const dotR = 20;
    const dotGap = 36;
    const totalCodeW = dotR * 2 + dotGap + codeW;
    const startX = cx - totalCodeW * 0.5;

    const accent = CAP_COLORS[cfg.use] ? `#${CAP_COLORS[cfg.use].getHexString()}` : '#639e92';
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(startX + dotR, 366, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0f13';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(codeText, startX + dotR * 2 + dotGap, 376);

    // ── 第三列：中文規格摘要（正中對齊，清晰不糊） ──
    const sOpt = config.source.options.find(o => o.id === cfg.source);
    const fOpt = config.form.options.find(o => o.id === cfg.form);
    const uOpt = config.use.options.find(o => o.id === cfg.use);
    ctx.fillStyle = 'rgba(12, 18, 22, 0.94)';
    ctx.font = '600 68px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${sOpt?.name || ''} · ${fOpt?.name || ''} · ${uOpt?.name || ''}`, cx, 558);

    // 下分隔細線
    ctx.strokeStyle = 'rgba(12, 18, 22, 0.26)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padX, 638);
    ctx.lineTo(w - padX, 638);
    ctx.stroke();

    // ── 第四列：檢測代碼（正中對齊）＋底部對稱刻度 ──
    const qcCodes = config.qc.options
      .filter(o => (cfg.qc || []).includes(o.id))
      .map(o => o.code);
    const qcStr = qcCodes.length ? qcCodes.join(' · ') : '—';

    ctx.font = '600 44px "Schibsted Grotesk", system-ui, sans-serif';
    const lblW = ctx.measureText('QC').width;
    ctx.font = '600 56px "Schibsted Grotesk", system-ui, sans-serif';
    const valW = ctx.measureText(qcStr).width;
    const qcGap = 32;
    const qcStart = cx - (lblW + qcGap + valW) * 0.5;

    ctx.textAlign = 'left';
    ctx.font = '600 44px "Schibsted Grotesk", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(12, 18, 22, 0.72)';
    ctx.fillText('QC', qcStart, 724);

    ctx.font = '600 56px "Schibsted Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#0c1216';
    ctx.fillText(qcStr, qcStart + lblW + qcGap, 724);

    ctx.strokeStyle = 'rgba(12, 18, 22, 0.34)';
    ctx.lineWidth = 2.8;
    for (let i = 0; i <= 24; i++) {
      const x = padX + (i / 24) * innerW;
      const tickH = i % 6 === 0 ? 24 : 12;
      ctx.beginPath();
      ctx.moveTo(x, h - 62);
      ctx.lineTo(x, h - 62 - tickH);
      ctx.stroke();
    }

    tex.needsUpdate = true;
  }

  return { tex, draw };
}

// ─── 血清瓶幾何（外玻璃平滑單層外殼＋獨立直筒內壁折射線，徹底杜絕肩部折線黑塊） ───
function createVialGeometries(high) {
  const segs = high ? 76 : 48;

  // 平滑外玻璃殼（厚底＋直壁＋柔順瓶肩＋瓶頸＋捲封唇緣）
  const outerPts = [
    new THREE.Vector2(0.002, 0.026),
    new THREE.Vector2(0.32, 0.020),
    new THREE.Vector2(0.47, 0.004),
    new THREE.Vector2(0.538, 0.022),
    new THREE.Vector2(0.560, 0.092),
    new THREE.Vector2(0.560, 1.48),
    new THREE.Vector2(0.554, 1.545),
    new THREE.Vector2(0.506, 1.635),
    new THREE.Vector2(0.410, 1.725),
    new THREE.Vector2(0.312, 1.792),
    new THREE.Vector2(0.272, 1.845),
    new THREE.Vector2(0.272, 1.975),
    new THREE.Vector2(0.342, 2.005),
    new THREE.Vector2(0.348, 2.088),
    new THREE.Vector2(0.330, 2.118),
    new THREE.Vector2(0.222, 2.118),
  ];
  const glassOuter = new THREE.LatheGeometry(outerPts, segs);
  glassOuter.computeVertexNormals();

  // 瓶身內腔壁（僅直筒至厚底，讓透明玻璃左右呈現真實雙層壁厚與厚玻璃底，絕不侵入瓶肩）
  const innerWallPts = [
    new THREE.Vector2(0.002, 0.158),
    new THREE.Vector2(0.37, 0.148),
    new THREE.Vector2(0.478, 0.168),
    new THREE.Vector2(0.508, 0.215),
    new THREE.Vector2(0.508, 1.45),
  ];
  const glassInnerWall = new THREE.LatheGeometry(innerWallPts, segs);
  glassInnerWall.computeVertexNormals();

  // 淺灰丁基膠塞（俐落收於上段瓶頸 y=1.88..2.15，絕不下垂到透明瓶肩造成灰黑方塊）
  const stopperPts = [
    new THREE.Vector2(0.002, 1.885),
    new THREE.Vector2(0.195, 1.885),
    new THREE.Vector2(0.206, 1.915),
    new THREE.Vector2(0.210, 2.09),
    new THREE.Vector2(0.336, 2.118),
    new THREE.Vector2(0.336, 2.148),
    new THREE.Vector2(0.002, 2.150),
  ];
  const stopperGeo = new THREE.LatheGeometry(stopperPts, 44);
  stopperGeo.computeVertexNormals();

  // 鋁製捲邊蓋（帶上滾邊肩與下捲收裙緣）
  const crimpPts = [
    new THREE.Vector2(0.290, 1.946),
    new THREE.Vector2(0.354, 1.958),
    new THREE.Vector2(0.370, 1.994),
    new THREE.Vector2(0.370, 2.150),
    new THREE.Vector2(0.362, 2.172),
    new THREE.Vector2(0.342, 2.182),
    new THREE.Vector2(0.165, 2.184),
    new THREE.Vector2(0.165, 2.150),
  ];
  const crimpGeo = new THREE.LatheGeometry(crimpPts, 64);
  crimpGeo.computeVertexNormals();

  // 霧面塑膠翻蓋
  const flipPts = [
    new THREE.Vector2(0.348, 2.180),
    new THREE.Vector2(0.378, 2.188),
    new THREE.Vector2(0.378, 2.262),
    new THREE.Vector2(0.358, 2.288),
    new THREE.Vector2(0.260, 2.290),
    new THREE.Vector2(0.242, 2.279),
    new THREE.Vector2(0.002, 2.279),
  ];
  const flipGeo = new THREE.LatheGeometry(flipPts, 56);
  flipGeo.computeVertexNormals();

  // 瓶內液體側壁（無頂底平蓋，頂緣由 shader 同步彎月面晃動傾角）
  const liqSideGeo = new THREE.CylinderGeometry(0.501, 0.499, 1.0, segs, 6, true);
  liqSideGeo.translate(0, 0.5, 0);

  // 凹彎月面幾何
  const menPts = [];
  const menSteps = 18;
  for (let i = 0; i <= menSteps; i++) {
    const u = i / menSteps;
    const r = Math.max(0.002, u * 0.502);
    const y = Math.pow(u, 4.0) * 0.056;
    menPts.push(new THREE.Vector2(r, y));
  }
  const meniscusGeo = new THREE.LatheGeometry(menPts, segs);
  meniscusGeo.computeVertexNormals();

  // 純白偏冷多孔凍乾餅（高約瓶身 1/4 ≈ 0.34，r=0.454 明顯收縮離壁有縫、頂面微凹＋自陰影頂點色）
  const lyoPts = [
    new THREE.Vector2(0.002, 0.0),
    new THREE.Vector2(0.422, 0.0),
    new THREE.Vector2(0.454, 0.022),
    new THREE.Vector2(0.450, 0.175), // 乾燥收縮微束腰
    new THREE.Vector2(0.456, 0.315),
    new THREE.Vector2(0.444, 0.348), // 微翹外緣唇
    new THREE.Vector2(0.390, 0.336),
    new THREE.Vector2(0.275, 0.312), // 明顯凹陷頂盤
    new THREE.Vector2(0.135, 0.296),
    new THREE.Vector2(0.002, 0.292),
  ];
  const lyoGeo = new THREE.LatheGeometry(lyoPts, 60);
  const pos = lyoGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.05 && y > 0.015) {
      const ang = Math.atan2(z, x);
      // 乾燥粉餅的微有機不規則邊緣與細微起伏
      const sideNoise = Math.sin(ang * 6 + y * 18) * 0.0055 + Math.cos(ang * 11 - y * 24) * 0.0032;
      x += (x / r) * sideNoise;
      z += (z / r) * sideNoise;
      if (y > 0.285) {
        y += Math.sin(x * 20) * Math.cos(z * 20) * 0.0065 + Math.sin(ang * 9) * 0.003;
      }
      pos.setXYZ(i, x, y, z);
    }

    // 烘焙柔和自陰影（底部接觸 AO ＋ 凹頂內陰影 ＋ 側壁微體積明暗，純白不偏藍）
    let ao = 0.94;
    if (y < 0.065) ao *= lerp(0.68, 1.0, y / 0.065);
    if (y > 0.285 && r < 0.43) {
      // 頂面凹盤內圈帶柔和自陰影，強化多孔凹面立體感
      const dish = 1.0 - clamp(r / 0.43);
      ao *= lerp(1.0, 0.74, dish * 0.92);
    } else if (y > 0.295 && r >= 0.43) {
      ao *= 1.04;
    }
    colors[i * 3]     = clamp(ao * 0.985, 0, 1);
    colors[i * 3 + 1] = clamp(ao * 0.990, 0, 1);
    colors[i * 3 + 2] = clamp(ao * 0.988, 0, 1);
  }
  lyoGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  lyoGeo.computeVertexNormals();

  // 弧面標籤：保持高度 0.54，正面 120° 弧面（y=0.78..1.32）
  const labelArc = Math.PI * 0.67;
  const labelGeo = new THREE.CylinderGeometry(
    0.5638,
    0.5638,
    0.54,
    56,
    1,
    true,
    -labelArc * 0.5,
    labelArc
  );
  const labelBackGeo = new THREE.CylinderGeometry(
    0.5624,
    0.5624,
    0.54,
    56,
    1,
    true,
    -labelArc * 0.5,
    labelArc
  );

  return { glassOuter, glassInnerWall, stopperGeo, crimpGeo, flipGeo, liqSideGeo, meniscusGeo, lyoGeo, labelGeo, labelBackGeo };
}

export async function createChapter({ renderer, quality, touch, reduced }) {
  const high = quality.tier === 'high';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef0ec');
  scene.environment = createStudioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 60);
  camera.position.set(0, 1.48, 5.25);

  // 無接縫微垂直漸層珍珠白攝影棚背景球（p=0.1 時提亮成清透珍珠白）
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uEmergeBright: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uEmergeBright;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 bot = vec3(0.84, 0.86, 0.835);
        vec3 mid = vec3(0.915, 0.93, 0.905);
        vec3 top = vec3(0.985, 0.995, 0.975);
        vec3 col = mix(bot, mid, smoothstep(0.28, 0.52, h));
        col = mix(col, top, smoothstep(0.52, 0.78, h));
        vec3 bright = vec3(1.06, 1.07, 1.05);
        col = mix(col, bright, uEmergeBright);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bgMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), bgMat);
  bgMesh.renderOrder = -10;
  scene.add(bgMesh);

  // 中性偏冷攝影棚主光（確保純白凍乾餅絕不偏黃，且有清楚明暗體積）
  const hemi = new THREE.HemisphereLight('#f8fbff', '#c6d0d6', 0.72);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight('#ffffff', 1.65);
  keyLight.position.set(-4.6, 6.4, 5.4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#e8f2f8', 0.88);
  rimLight.position.set(5.2, 3.8, -3.2);
  scene.add(rimLight);

  // ─── 瓶體階層：vialAnchor（構圖位姿＋直式縮放） → vialSpin（互動旋轉） ───
  const vialAnchor = new THREE.Group();
  scene.add(vialAnchor);

  const shadowTex = createFloorShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), shadowMat);
  shadowMesh.rotation.x = -Math.PI * 0.5;
  shadowMesh.position.set(0.04, 0.002, -0.02);
  shadowMesh.renderOrder = 0;
  vialAnchor.add(shadowMesh);

  const vialSpin = new THREE.Group();
  vialAnchor.add(vialSpin);

  const geos = createVialGeometries(high);
  const aluTex = createAluminumTextures();
  const lyoTex = createLyoTextures();
  const plasticBump = createMattePlasticBump();
  const labelCtrl = createLabelController(renderer);

  // 1. 玻璃瓶身外殼（平滑外輪廓，thickness 0.16 呈現乾淨折射，絕不抽樣出肩部黑塊）
  const glassMat = high
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fbfdfc'),
        transmission: 0.94,
        ior: 1.49,
        thickness: 0.16,
        roughness: 0.038,
        metalness: 0.0,
        attenuationColor: new THREE.Color('#d6e5e0'),
        attenuationDistance: 3.6,
        clearcoat: 0.42,
        clearcoatRoughness: 0.035,
        envMapIntensity: 1.30,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f4f8f6'),
        transparent: true,
        opacity: 0.24,
        roughness: 0.055,
        metalness: 0.04,
        clearcoat: 0.55,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.45,
        depthWrite: false,
      });

  const glassMesh = new THREE.Mesh(geos.glassOuter, glassMat);
  glassMesh.renderOrder = 2;
  vialSpin.add(glassMesh);

  // 1b. 瓶身直筒內壁折射細線（僅直筒至厚底，勾勒真實玻璃壁厚，絕不出現於瓶肩）
  const innerWallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vY;
      void main() {
        vec3 N = vNormalW / max(length(vNormalW), 1e-5);
        vec3 V = vViewW / max(length(vViewW), 1e-5);
        float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fres = pow(max(1.0 - ndv, 0.0), 3.6);
        float topFade = 1.0 - smoothstep(1.36, 1.45, vY);
        float edgeA = smoothstep(0.30, 0.90, fres) * 0.28 * topFade;
        float baseRim = (1.0 - smoothstep(0.145, 0.21, vY)) * 0.22;
        vec3 col = vec3(0.12, 0.18, 0.21);
        gl_FragColor = vec4(col, clamp(edgeA + baseRim, 0.0, 0.38) * uOpacity);
      }
    `,
  });
  const innerWallMesh = new THREE.Mesh(geos.glassInnerWall, innerWallMat);
  innerWallMesh.renderOrder = 3;
  vialSpin.add(innerWallMesh);

  // 2. 外玻璃輪廓強化層（嚴格貼於外殼：俐落雙側暗邊、厚底焦散、直條柔光與瓶肩高光）
  const contourMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uOpacity: { value: 1.0 },
      uStrength: { value: high ? 1.12 : 1.42 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uStrength;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vY;
      void main() {
        vec3 N = vNormalW / max(length(vNormalW), 1e-5);
        vec3 V = vViewW / max(length(vViewW), 1e-5);
        float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fres = pow(max(1.0 - ndv, 0.0), 3.0);

        // 俐落明確的左右玻璃外輪廓暗線（純外殼，無肩內黑塊）
        float darkEdge = smoothstep(0.24, 0.88, fres) * 0.62 * uStrength;

        // 厚瓶底玻璃折射暗帶＋底部內反射焦散亮弧
        float baseZone = 1.0 - smoothstep(0.01, 0.21, vY);
        float baseDark = baseZone * smoothstep(0.08, 0.70, fres) * 0.44;
        float baseCaustic = smoothstep(0.02, 0.08, vY) * (1.0 - smoothstep(0.08, 0.19, vY))
          * smoothstep(0.35, 0.92, ndv) * 0.44;

        // 雙側長條柔光箱直條高光
        vec3 L1 = normalize(vec3(-0.62, 0.12, 0.78));
        vec3 H1 = normalize(L1 + V);
        float spec1 = pow(max(dot(N, H1), 0.0), 115.0) * 1.08;
        vec3 L2 = normalize(vec3(0.76, 0.10, 0.64));
        vec3 H2 = normalize(L2 + V);
        float spec2 = pow(max(dot(N, H2), 0.0), 145.0) * 0.74;

        // 瓶肩弧面柔亮高光
        float shoulderZone = smoothstep(1.46, 1.58, vY) * (1.0 - smoothstep(1.76, 1.88, vY));
        vec3 Ltop = normalize(vec3(-0.24, 0.85, 0.47));
        vec3 Htop = normalize(Ltop + V);
        float specShoulder = pow(max(dot(N, Htop), 0.0), 40.0) * shoulderZone * 0.98;

        float darkA = clamp(darkEdge + baseDark, 0.0, 0.78);
        float specA = clamp(spec1 + spec2 + specShoulder + baseCaustic, 0.0, 0.94);

        vec3 darkCol = vec3(0.045, 0.075, 0.095);
        vec3 specCol = vec3(1.18, 1.20, 1.18);
        float totalA = clamp(darkA + specA, 0.0, 0.90);
        vec3 col = mix(darkCol, specCol, specA / max(darkA + specA, 1e-4));
        gl_FragColor = vec4(col, totalA * uOpacity);
      }
    `,
  });
  const contourMesh = new THREE.Mesh(geos.glassOuter, contourMat);
  contourMesh.renderOrder = 4;
  vialSpin.add(contourMesh);

  // 3. 弧面瓶身標籤（保持高度 0.54，位於 y=1.05，正面 120° 置中對準鏡頭）
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelCtrl.tex,
    roughness: 0.86,
    metalness: 0.0,
    envMapIntensity: 0.55,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const labelMesh = new THREE.Mesh(geos.labelGeo, labelMat);
  labelMesh.position.y = 1.05;
  vialSpin.add(labelMesh);

  const labelBackMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f7f8f5'),
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.BackSide,
  });
  const labelBackMesh = new THREE.Mesh(geos.labelBackGeo, labelBackMat);
  labelBackMesh.position.y = 1.05;
  vialSpin.add(labelBackMesh);

  // 4. 封口組件（淺灰丁基膠塞收於瓶頸＋細捲邊拉絲鋁蓋＋霧面塑膠翻蓋）
  const capGroup = new THREE.Group();
  vialSpin.add(capGroup);

  const stopperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#aeb6bc'),
    roughness: 0.84,
    metalness: 0.02,
    bumpMap: plasticBump,
    bumpScale: 0.003,
  });
  const stopperMesh = new THREE.Mesh(geos.stopperGeo, stopperMat);
  capGroup.add(stopperMesh);

  const crimpMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e4e8ea'),
    metalness: 0.92,
    roughness: 0.30,
    roughnessMap: aluTex.rough,
    bumpMap: aluTex.bump,
    bumpScale: 0.017,
    envMapIntensity: 1.32,
  });
  const crimpMesh = new THREE.Mesh(geos.crimpGeo, crimpMat);
  capGroup.add(crimpMesh);

  const flipHolder = new THREE.Group();
  capGroup.add(flipHolder);

  const flipMat = new THREE.MeshPhysicalMaterial({
    color: CAP_COLORS.ingredient.clone(),
    roughness: 0.66,
    metalness: 0.0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.65,
    bumpMap: plasticBump,
    bumpScale: 0.0025,
    envMapIntensity: 0.72,
  });
  const flipMesh = new THREE.Mesh(geos.flipGeo, flipMat);
  flipHolder.add(flipMesh);

  // 5. 瓶內液體（僅 liquid 模式呈現半透明淡玉液體與凹彎月面）
  const liquidGroup = new THREE.Group();
  liquidGroup.position.y = 0.165;
  vialSpin.add(liquidGroup);

  const liquidMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    uniforms: {
      uAlpha: { value: 0.0 },
      uLevel: { value: 1.21 },
      uTiltX: { value: 0.0 },
      uTiltZ: { value: 0.0 },
      uRipple: { value: 0.0 },
    },
    vertexShader: `
      uniform float uLevel;
      uniform float uTiltX;
      uniform float uTiltZ;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vH;
      void main() {
        vec3 p = position;
        vH = p.y;
        float topY = uLevel + (p.x * uTiltZ - p.z * uTiltX) + 0.052;
        p.y = p.y * max(topY, 0.02);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uAlpha;
      uniform float uRipple;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vH;
      void main() {
        vec3 N = vNormalW / max(length(vNormalW), 1e-5);
        vec3 V = vViewW / max(length(vViewW), 1e-5);
        float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fres = pow(max(1.0 - ndv, 0.0), 1.9);
        vec3 core = vec3(0.76, 0.87, 0.85);
        vec3 rim  = vec3(0.36, 0.56, 0.55);
        vec3 col = mix(core, rim, fres * 0.78);
        float topGlow = smoothstep(0.86, 1.0, vH) * 0.24;
        float botDepth = (1.0 - smoothstep(0.0, 0.22, vH)) * 0.14;
        col += vec3(0.18, 0.24, 0.22) * (topGlow + uRipple * 0.12);
        float a = (0.24 + fres * 0.36 + topGlow + botDepth) * uAlpha;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.72));
      }
    `,
  });
  const liquidBody = new THREE.Mesh(geos.liqSideGeo, liquidMat);
  liquidBody.renderOrder = 3;
  liquidGroup.add(liquidBody);

  const meniscusMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uAlpha: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vR;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        vR = length(position.xz) / 0.502;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uAlpha;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vR;
      void main() {
        vec3 N = vNormalW / max(length(vNormalW), 1e-5);
        vec3 V = vViewW / max(length(vViewW), 1e-5);
        float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float rim = smoothstep(0.72, 1.0, vR);
        float spec = pow(max(1.0 - ndv, 0.0), 2.2);
        vec3 col = mix(vec3(0.74, 0.87, 0.85), vec3(1.16, 1.20, 1.18), rim * 0.78 + spec * 0.45);
        float a = (0.36 + rim * 0.50 + spec * 0.22) * uAlpha;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.88));
      }
    `,
  });
  const meniscusMesh = new THREE.Mesh(geos.meniscusGeo, meniscusMat);
  meniscusMesh.position.y = 1.21;
  meniscusMesh.renderOrder = 3;
  liquidGroup.add(meniscusMesh);

  // 6. 純白多孔凍乾餅（不透光、低環境反射、高粉質粗糙度＋清晰孔洞裂紋＋頂點自陰影）
  const lyoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f5f6f3'),
    map: lyoTex.map,
    vertexColors: true,
    roughness: 0.97,
    metalness: 0.0,
    bumpMap: lyoTex.bump,
    bumpScale: 0.052,
    envMapIntensity: 0.14,
  });
  const lyoMesh = new THREE.Mesh(geos.lyoGeo, lyoMat);
  lyoMesh.position.y = 0.168;
  vialSpin.add(lyoMesh);

  // 7. 瓶內外泌體珍珠微粒（InstancedMesh）
  const pCount = high ? 104 : 30;
  const pGeo = new THREE.IcosahedronGeometry(0.0155, 1);
  const pMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d4eee5'),
    emissive: new THREE.Color('#b8dfd3'),
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
  });
  const particles = new THREE.InstancedMesh(pGeo, pMat, pCount);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vialSpin.add(particles);

  const pData = [];
  let pSeed = 4201;
  const pRand = () => {
    pSeed = (pSeed * 16807) % 2147483647;
    return (pSeed - 1) / 2147483646;
  };
  for (let i = 0; i < pCount; i++) {
    const u = pRand();
    const ang = pRand() * Math.PI * 2;
    const rad = Math.sqrt(pRand()) * 0.40;
    pData.push({
      ang,
      rad,
      yLiq: 0.22 + u * 1.12,
      yLyo: 0.21 + u * 0.28, // 對應 1/4 高凍乾餅（y=0.17..0.51）
      speed: (0.24 + pRand() * 0.40) * (pRand() > 0.5 ? 1 : -1),
      phase: pRand() * Math.PI * 2,
      scale: 0.68 + pRand() * 0.72,
      cloudR: 0.35 + pRand() * 1.45,
      cloudY: 1.65 + pRand() * 1.85,
      cloudAng: ang + (pRand() - 0.5) * 2.2,
    });
  }

  // 8. 隨附檢測極細刻度環（兩側清晰、正面標籤前完全淡出，不劃過文字）
  const qcRingsGroup = new THREE.Group();
  vialAnchor.add(qcRingsGroup);

  const sharedVialCenter = { value: new THREE.Vector3(0, 1.0, 0) };
  function createSideFadeRingMaterial(hexColor, maxOpacity) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uColor: { value: new THREE.Color(hexColor) },
        uOpacity: { value: 0.0 },
        uMaxOpacity: { value: maxOpacity },
        uVialCenter: sharedVialCenter,
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uMaxOpacity;
        uniform vec3 uVialCenter;
        varying vec3 vWorldPos;
        void main() {
          vec2 radV = vWorldPos.xz - uVialCenter.xz;
          vec2 camV = cameraPosition.xz - uVialCenter.xz;
          vec2 radN = radV / max(length(radV), 1e-5);
          vec2 camN = camV / max(length(camV), 1e-5);
          // front = +1（標籤正前方）→ 淡出為 0；front ≈ 0（瓶身左右兩側）→ 清晰顯示
          float front = dot(radN, camN);
          float frontFade = 1.0 - smoothstep(-0.02, 0.48, front);
          float backSoft  = mix(0.24, 1.0, smoothstep(-0.92, -0.18, front));
          float alpha = uOpacity * uMaxOpacity * frontFade * backSoft;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }

  const qcSpecs = [
    { id: 'nta',     r: 0.68, y: 0.44, tiltX:  0.05, tiltZ: -0.03, speed:  0.045, ticks: 24, dot: '#369486' },
    { id: 'tem',     r: 0.71, y: 0.74, tiltX: -0.04, tiltZ:  0.04, speed: -0.040, ticks: 16, dot: '#23323b' },
    { id: 'marker',  r: 0.73, y: 1.05, tiltX:  0.04, tiltZ:  0.03, speed:  0.036, ticks: 24, dot: '#847eb8' },
    { id: 'purity',  r: 0.70, y: 1.35, tiltX: -0.05, tiltZ: -0.04, speed: -0.042, ticks: 16, dot: '#c9a25e' },
    { id: 'sterile', r: 0.67, y: 1.62, tiltX:  0.04, tiltZ: -0.04, speed:  0.048, ticks: 12, dot: '#23323b' },
  ];

  const majorTickGeo = new THREE.BoxGeometry(0.0032, 0.0032, 0.036);
  const minorTickGeo = new THREE.BoxGeometry(0.0024, 0.0024, 0.018);
  const indexDotGeo = new THREE.SphereGeometry(0.012, 10, 8);

  const qcRings = qcSpecs.map((sp, idx) => {
    const holder = new THREE.Group();
    holder.position.y = sp.y;
    holder.rotation.set(sp.tiltX, 0, sp.tiltZ);

    const ringGeo = new THREE.TorusGeometry(sp.r, 0.0028, 8, 128);
    ringGeo.rotateX(Math.PI * 0.5);
    const mat = createSideFadeRingMaterial('#1c2a33', 0.66);
    const ringMesh = new THREE.Mesh(ringGeo, mat);
    ringMesh.renderOrder = 5;
    holder.add(ringMesh);

    for (let i = 0; i < sp.ticks; i++) {
      const a = (i / sp.ticks) * Math.PI * 2;
      const major = i % 4 === 0;
      const tick = new THREE.Mesh(major ? majorTickGeo : minorTickGeo, mat);
      const offset = major ? 0.020 : 0.012;
      tick.position.set(Math.sin(a) * (sp.r + offset), 0, Math.cos(a) * (sp.r + offset));
      tick.rotation.y = a;
      tick.renderOrder = 5;
      holder.add(tick);
    }

    const dotMat = createSideFadeRingMaterial(sp.dot, 0.92);
    const dotMesh = new THREE.Mesh(indexDotGeo, dotMat);
    const sideSign = idx % 2 === 0 ? 1 : -1;
    dotMesh.position.set(sideSign * sp.r, 0, 0);
    dotMesh.renderOrder = 5;
    holder.add(dotMesh);

    qcRingsGroup.add(holder);
    return { ...sp, holder, mat, dotMat, k: 0, dropAnim: 0, active: false };
  });

  // 9. 開頭明亮珍珠白顯影光暈
  const veilMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uOpacity: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length((vUv - 0.5) * 2.0);
        float glow = exp(-d * d * 1.45);
        vec3 col = vec3(1.16, 1.18, 1.15);
        gl_FragColor = vec4(col, clamp(glow * uOpacity, 0.0, 0.94));
      }
    `,
  });
  const veilMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), veilMat);
  veilMesh.position.set(0, 1.25, 1.5);
  veilMesh.renderOrder = 8;
  vialAnchor.add(veilMesh);

  // ─── 規格與互動動畫狀態 ───
  const state = {
    source: 'uc',
    form: 'lyo',
    use: 'ingredient',
    qc: ['nta', 'marker'],
    code: 'UC-LY-I',
  };
  let initializedCfg = false;
  let lyoMix = 1.0;
  let targetLyoMix = 1.0;
  let formPulse = 0;
  let useAnim = 0;
  let inspectSway = 0;
  let targetCapColor = CAP_COLORS.ingredient.clone();
  let labelFlash = 0;

  let rotY = 0;
  let rotVel = 0;
  let sloshAngle = 0;
  let sloshVel = 0;

  let aspect = 16 / 9;
  let isPortrait = false;

  const dummy = new THREE.Object3D();
  const camTarget = new THREE.Vector3(0, 1.24, 0);

  function applyConfig(cfg, initial = false) {
    if (!cfg) return;
    const formChanged = !initial && cfg.form && cfg.form !== state.form;
    const useChanged = !initial && cfg.use && cfg.use !== state.use;
    const anyChanged = !initial && (
      cfg.source !== state.source ||
      formChanged ||
      useChanged ||
      cfg.code !== state.code ||
      (cfg.qc || []).join(',') !== state.qc.join(',')
    );

    state.source = cfg.source || state.source;
    state.form = cfg.form || state.form;
    state.use = cfg.use || state.use;
    state.qc = Array.isArray(cfg.qc) ? cfg.qc : state.qc;
    state.code = cfg.code || state.code;

    targetLyoMix = state.form === 'lyo' ? 1.0 : 0.0;
    if (initial) lyoMix = targetLyoMix;

    targetCapColor = (CAP_COLORS[state.use] || CAP_COLORS.ingredient).clone();
    if (initial) flipMat.color.copy(targetCapColor);

    const activeSet = new Set(state.qc);
    for (const r of qcRings) {
      const nextActive = activeSet.has(r.id);
      if (!initial && nextActive && !r.active) {
        r.dropAnim = 1.0;
      }
      r.active = nextActive;
      if (initial) r.k = r.active ? 1 : 0;
    }

    labelCtrl.draw(state);

    if (formChanged && !reduced) {
      formPulse = 1.0;
      sloshVel += state.form === 'liquid' ? 0.55 : -0.40;
      inspectSway = 0.85;
    }
    if (useChanged && !reduced) {
      useAnim = 1.0;
      inspectSway = 1.0;
    }
    if (anyChanged) {
      labelFlash = 1.0;
    }
  }

  applyConfig(state, true);
  document.fonts?.ready?.then(() => labelCtrl.draw(state));

  return {
    scene,
    camera,
    labels: [],

    resize(w, h) {
      aspect = Math.max(w / Math.max(h, 1), 0.35);
      isPortrait = aspect < 0.95;
    },

    set(cfg) {
      applyConfig(cfg, !initializedCfg);
      initializedCfg = true;
    },

    theme() {
      return 1;
    },

    bloom(p) {
      const emerge = 1 - smooth(0.0, 0.30, p);
      return {
        strength: 0.030 + emerge * 0.028, // 恆 <= 0.058（嚴格 <= 0.06）
        radius: 0.42,
        threshold: 0.94,
      };
    },

    update(p, t, dt, ptr) {
      const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
      const motion = reduced ? 0.15 : 1.0;

      // ─── 1. 捲動階段（完全由 p 決定） ───
      const emergeK = smooth(0.02, 0.32, p);
      const sealK = smooth(0.16, 0.34, p);
      const frameK = smooth(0.35, 0.50, p);

      // 明亮珍珠白顯影
      const emergeGlow = 1 - smooth(0.0, 0.32, p);
      bgMat.uniforms.uEmergeBright.value = emergeGlow * 0.88;
      const veilK = emergeGlow * 0.78;
      veilMat.uniforms.uOpacity.value = veilK;
      veilMesh.visible = veilK > 0.005;

      // 瓶身自白光顯影上升定位
      const appearScale = lerp(0.93, 1.0, emergeK);
      vialSpin.scale.setScalar(appearScale);
      vialSpin.position.y = lerp(-0.20, 0.0, emergeK);
      contourMat.uniforms.uOpacity.value = lerp(0.35, 1.0, emergeK);
      innerWallMat.uniforms.uOpacity.value = lerp(0.25, 1.0, emergeK);
      shadowMat.opacity = lerp(0.0, 0.96, smooth(0.10, 0.36, p));

      // 落蓋封口動畫（行程收斂至 0.58，確保 p=0.25..0.35 瓶蓋頂遠離頂部導覽列）
      const capLift = Math.pow(1 - sealK, 2.2) * 0.58;
      capGroup.position.y = capLift;
      capGroup.rotation.y = (1 - sealK) * 0.50;

      // ─── 2. 鏡頭退位與構圖（p=0.3 瓶蓋頂離上緣 >= 90px；手機 390x844 縮小上移避開標題） ───
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const tanHalf = Math.tan(fovRad * 0.5);

      let startDist, finalDist, finalAnchorX, startCamY, finalCamY, startLookY, finalLookY, anchorScale;
      if (isPortrait) {
        anchorScale = 0.78;
        startDist = clamp(1.22 / (Math.max(aspect, 0.38) * tanHalf), 7.2, 8.6);
        finalDist = clamp(1.38 / (Math.max(aspect, 0.38) * tanHalf), 8.2, 9.9);
        finalAnchorX = 0.0;
        startCamY = 0.72;
        startLookY = 0.54;
        // 瓶子縮小上移至螢幕上 110..362px，完全避開頂部 72px 導覽列與底部組規格器標題
        finalCamY = -0.08;
        finalLookY = -0.42;
      } else {
        anchorScale = 1.0;
        // p=0.3 拉遠並微抬視線 → 瓶蓋頂落於畫面上緣下 ~165px（遠大於 90px）
        startDist = 5.25;
        finalDist = 5.55;
        const halfW = finalDist * tanHalf * aspect;
        finalAnchorX = clamp(halfW * 0.35, 0.68, 1.24);
        startCamY = 1.48;
        startLookY = 1.36;
        finalCamY = 1.34;
        finalLookY = 1.24;
      }

      const dist = lerp(startDist, finalDist, frameK);
      const anchorX = lerp(0.0, finalAnchorX, frameK);
      const camY = lerp(startCamY, finalCamY, frameK);
      const lookY = lerp(startLookY, finalLookY, frameK);

      vialAnchor.position.set(anchorX, 0, 0);
      vialAnchor.scale.setScalar(anchorScale);
      sharedVialCenter.value.set(anchorX, 1.0 * anchorScale, 0);

      // 滑鼠微視差
      const parScale = (touch ? 0.25 : 1.0) * motion * lerp(0.35, 1.0, frameK);
      const px = (ptr?.x || 0) * 0.20 * parScale;
      const py = (ptr?.y || 0) * 0.12 * parScale;
      camera.position.set(px, camY + py, dist);
      camTarget.set(px * 0.15, lookY, 0);
      camera.lookAt(camTarget);

      // ─── 3. 標籤預設正中對準鏡頭 ＋ 互動拖曳旋轉（帶慣性） ───
      if (inspectSway > 0.001) {
        inspectSway = Math.max(0, inspectSway - safeDt * 1.9);
      }
      const swayAngle = Math.sin(inspectSway * Math.PI * 1.5) * inspectSway * 0.14 * motion;
      const faceCamYaw = Math.atan2(-anchorX, dist);
      const idleDrift = reduced ? 0 : Math.sin(t * 0.42) * 0.032 * frameK;
      const emergeYaw = (1 - emergeK) * -0.32;
      const targetRotY = faceCamYaw + emergeYaw + (ptr?.dragX || 0) * 5.2 + idleDrift + swayAngle;
      const prevRotY = rotY;
      rotY += (targetRotY - rotY) * (reduced ? 1 : 1 - Math.exp(-safeDt * 7.5));
      rotVel = (rotY - prevRotY) / safeDt;
      vialSpin.rotation.y = rotY;

      // ─── 4. 換 use 翻蓋彈起換色落蓋動畫 ＋ 標籤刷新高光 ───
      flipMat.color.lerp(targetCapColor, reduced ? 1 : 1 - Math.exp(-safeDt * 7.0));
      if (useAnim > 0.001) {
        useAnim = Math.max(0, useAnim - safeDt * 1.65);
        const u = 1 - useAnim;
        const lift = Math.sin(u * Math.PI) * 0.16 * (1 - u * 0.25);
        const bounce = u > 0.72 ? Math.sin((u - 0.72) / 0.28 * Math.PI) * 0.018 : 0;
        flipHolder.position.y = lift + bounce;
        flipHolder.rotation.y = Math.sin(u * Math.PI) * 0.42;
        const popScale = 1 + Math.sin(u * Math.PI) * 0.045;
        flipHolder.scale.set(popScale, 1, popScale);
      } else {
        flipHolder.position.y = 0;
        flipHolder.rotation.y = 0;
        flipHolder.scale.set(1, 1, 1);
      }

      if (labelFlash > 0.001) {
        labelFlash = Math.max(0, labelFlash - safeDt * 3.0);
        labelMat.emissiveIntensity = labelFlash * 0.24;
      } else if (labelMat.emissiveIntensity !== 0) {
        labelMat.emissiveIntensity = 0;
      }

      // ─── 5. 換 form 液態 ↔ 純白多孔凍乾餅動畫（凍乾態完全隱藏液體與彎月面） ───
      const morphStep = reduced ? 1 : 1 - Math.exp(-safeDt * 3.8);
      lyoMix += (targetLyoMix - lyoMix) * morphStep;
      if (Math.abs(targetLyoMix - lyoMix) < 0.0008) lyoMix = targetLyoMix;

      if (formPulse > 0.001) {
        formPulse = Math.max(0, formPulse - safeDt * 1.35);
      }

      const liqVis = clamp(1 - smooth(0.12, 0.80, lyoMix)) * emergeK;
      const lyoVis = smooth(0.18, 0.96, lyoMix) * emergeK;

      const sloshForce = clamp(rotVel * 0.034, -0.15, 0.15) * motion;
      sloshVel += (sloshForce - sloshAngle * 22.0 - sloshVel * 4.2) * safeDt;
      sloshAngle = clamp(sloshAngle + sloshVel * safeDt, -0.14, 0.14);

      const liqLevel = lerp(1.21, 0.34, smooth(0.0, 0.80, lyoMix));
      liquidGroup.visible = liqVis > 0.005;
      if (liquidGroup.visible) {
        const waveAmp = 0.008 + formPulse * 0.035;
        const tiltZ = sloshAngle + (reduced ? 0 : Math.sin(t * 2.4) * waveAmp);
        const tiltX = (reduced ? 0 : Math.cos(t * 1.8) * waveAmp * 0.8 * motion) + sloshAngle * 0.35;
        liquidMat.uniforms.uLevel.value = liqLevel;
        liquidMat.uniforms.uTiltZ.value = tiltZ;
        liquidMat.uniforms.uTiltX.value = tiltX;
        liquidMat.uniforms.uRipple.value = formPulse;
        liquidMat.uniforms.uAlpha.value = liqVis;
        meniscusMesh.position.y = liqLevel;
        meniscusMesh.rotation.z = tiltZ;
        meniscusMesh.rotation.x = tiltX;
        meniscusMat.uniforms.uAlpha.value = liqVis;
      }

      lyoMesh.visible = lyoVis > 0.01;
      if (lyoMesh.visible) {
        const dryShrink = lerp(1.06, 1.0, lyoVis);
        const crystalRise = 1 - Math.pow(1 - lyoVis, 2.2);
        lyoMesh.scale.set(dryShrink, Math.max(0.01, crystalRise), dryShrink);
      }

      // ─── 6. 瓶內外泌體珍珠微粒（顯影匯入 ＋ 換劑型上下分散／沉降） ───
      pMat.emissiveIntensity = lerp(0.55, 0.22, emergeK);
      const gatherK = smooth(0.02, 0.30, p);
      for (let i = 0; i < pCount; i++) {
        const d = pData[i];
        const swirlBoost = 1.0 + formPulse * 3.2;
        const driftAng = d.ang + t * d.speed * (0.28 + 0.72 * (1 - lyoMix)) * motion + formPulse * 0.85 * Math.sin(d.phase);
        const innerR = d.rad * lerp(1.0, 0.85, lyoMix);
        const innerY = lerp(d.yLiq, d.yLyo, lyoMix) + Math.sin(t * 1.1 * swirlBoost + d.phase) * (0.024 + formPulse * 0.04) * (1 - lyoMix * 0.75) * motion;
        const ix = Math.cos(driftAng) * innerR;
        const iz = Math.sin(driftAng) * innerR;

        let pxPos = ix;
        let pyPos = innerY;
        let pzPos = iz;
        let sc = d.scale;

        if (gatherK < 0.999) {
          const swirl = (1 - gatherK) * 1.8;
          const ca = d.cloudAng + swirl;
          const neckPinch = Math.sin(gatherK * Math.PI);
          const cr = lerp(d.cloudR, innerR, gatherK) * (1 - neckPinch * 0.62);
          pxPos = lerp(Math.cos(ca) * cr, ix, smooth(0.55, 1.0, gatherK));
          pzPos = lerp(Math.sin(ca) * cr, iz, smooth(0.55, 1.0, gatherK));
          pyPos = lerp(d.cloudY, innerY, gatherK * gatherK * (3 - 2 * gatherK));
          sc *= lerp(1.38, 1.0, gatherK);
        }

        sc *= lerp(1.0, 0.70, lyoMix);
        dummy.position.set(pxPos, pyPos, pzPos);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      // ─── 7. 隨附檢測極細刻度環（兩側清楚、正面標籤前自動淡出，選取落定） ───
      const ringsAllowed = smooth(0.32, 0.50, p);
      const ringStep = reduced ? 1 : 1 - Math.exp(-safeDt * 4.8);
      for (let i = 0; i < qcRings.length; i++) {
        const r = qcRings[i];
        const target = r.active ? 1 : 0;
        r.k += (target - r.k) * ringStep;
        if (Math.abs(target - r.k) < 0.001) r.k = target;

        if (r.dropAnim > 0.001) {
          r.dropAnim = Math.max(0, r.dropAnim - safeDt * 2.1);
        }

        const vis = r.k * ringsAllowed;
        r.holder.visible = vis > 0.004;
        if (r.holder.visible) {
          const settle = 1 - Math.pow(1 - vis, 3);
          const dropY = (1 - settle) * 0.34 + Math.pow(r.dropAnim, 2) * 0.22;
          const overshoot = Math.sin((1 - r.dropAnim) * Math.PI) * r.dropAnim * 0.025;
          r.holder.position.y = r.y + dropY;
          const sc = lerp(1.18, 1.0, settle) + overshoot;
          r.holder.scale.setScalar(sc);
          r.holder.rotation.y = t * r.speed * motion + i * 0.85 + r.dropAnim * 0.55;
          r.mat.uniforms.uOpacity.value = vis;
          r.dotMat.uniforms.uOpacity.value = vis;
        }
      }
    },
  };
}
