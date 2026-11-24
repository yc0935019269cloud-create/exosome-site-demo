// 開場的 MSC 全貌：螢光顯微的點雲（核、粒線體網、肌動蛋白應力纖維、膜輪廓）加一層薄膜殼
import * as THREE from 'three';
import { bokehMaterial, COMMON } from './glsl.js';
import { rng, CELL, cellW, cellV0, cellH, cellToWorld, NUCLEUS } from './path.js';

class Cloud {
  constructor(max) { this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.sz = new Float32Array(max * 2); this.n = 0; this.max = max; this.r = rng(9); }
  // 細胞座標
  add(u, y, v, c, k, size) {
    if (this.n >= this.max) return;
    const i = this.n++;
    cellToWorld(u, y, v, this.pos, i * 3);
    this.col[i * 3] = c[0] * k; this.col[i * 3 + 1] = c[1] * k; this.col[i * 3 + 2] = c[2] * k;
    this.sz[i * 2] = size; this.sz[i * 2 + 1] = this.r();
  }
  build(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col.subarray(0, this.n * 3), 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(this.sz.subarray(0, this.n * 2), 2));
    const m = new THREE.Points(g, mat); m.frustumCulled = false; return m;
  }
}

export function createOverview(shared, quality) {
  const cf = quality.tier === 'low' ? 0.34 : 1;
  const r = rng(2024), L = CELL.L;
  const group = new THREE.Group();
  const cloud = new Cloud(Math.ceil(130000 * cf) + 2000);
  const gauss = () => (r() + r() + r() + r() - 2) * 0.87;

  const ACTIN = [0.20, 0.80, 0.68], MITO = [0.95, 0.40, 0.62], NUC = [0.46, 0.25, 0.95], MEMB = [0.07, 0.50, 0.50], CYTO = [0.30, 0.50, 0.62];

  // 肌動蛋白應力纖維：沿長軸、往兩端的突起收束
  const nf = Math.round(190 * cf);
  for (let f = 0; f < nf; f++) {
    const vn = (r() * 2 - 1) * 0.9, full = r() < 0.45;
    const u1 = full ? -L * (0.75 + 0.22 * r()) : -L * 0.9 * r(), u2 = full ? L * (0.75 + 0.22 * r()) : u1 + 40 + r() * 180;
    const dorsal = r() < 0.25, y0 = 0.4 + r() * 1.3, br = 0.35 + r() * 0.75, wob = r() * 6.28, sp = 1.25;
    for (let u = u1; u < Math.min(u2, L * 0.985); u += sp) {
      const w = cellW(u), vv = vn + 0.02 * Math.sin(u * 0.05 + wob);
      const y = dorsal ? cellH(u, vv) * 0.9 : y0;
      if (dorsal === false && cellH(u, vv) < y) continue;
      cloud.add(u + r() * sp, y + gauss() * 0.12, cellV0(u) + vv * w + gauss() * 0.14, ACTIN, 0.28 * br, 0.40);
    }
  }
  // 粒線體網：核周往外放射的分支細管
  const nm = Math.round(120 * cf);
  for (let m = 0; m < nm; m++) {
    const th = r() * 6.283; let u = Math.cos(th) * (NUCLEUS.ru + 3 + r() * 14), v = NUCLEUS.v + Math.sin(th) * (NUCLEUS.rv + 3 + r() * 8);
    let dir = Math.atan2(Math.sin(th) * 0.5, Math.cos(th)) + gauss() * 0.5; const steps = 25 + r() * 70 | 0, yk = 0.25 + r() * 0.45, br = 0.5 + r() * 0.6;
    for (let s = 0; s < steps; s++) {
      dir += gauss() * 0.22; dir -= Math.sin(dir) * 0.02;
      u += Math.cos(dir) * 0.8; v += Math.sin(dir) * 0.8;
      const w = cellW(u), vn = (v - cellV0(u)) / w;
      if (Math.abs(vn) > 0.82 || Math.abs(u) > L * 0.8) break;
      const du = u / (NUCLEUS.ru + 1.5), dv = (v - NUCLEUS.v) / (NUCLEUS.rv + 1.5);
      if (du * du + dv * dv < 1) { dir += 0.6; continue; }
      cloud.add(u, cellH(u, vn) * yk + 0.6, v, MITO, 0.24 * br, 0.56);
      if (r() < 0.5) cloud.add(u + gauss() * 0.3, cellH(u, vn) * yk + 0.6 + gauss() * 0.3, v + gauss() * 0.3, MITO, 0.16 * br, 0.45);
    }
  }
  // 細胞核：核膜殼、染色質團塊、核仁
  const nn = Math.round(13000 * cf);
  for (let i = 0; i < nn; i++) {
    let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const shell = r() < 0.4, rad = shell ? 1 : Math.cbrt(r()) * 0.96;
    const clump = 0.5 + 0.5 * Math.sin(x * rad * 7 + 1) * Math.sin(y * rad * 6 + z * 5) * Math.sin(z * rad * 8 + 2);
    if (!shell && r() > 0.25 + 0.75 * clump) continue;
    cloud.add(NUCLEUS.u + x * rad * NUCLEUS.ru, NUCLEUS.y + y * rad * NUCLEUS.ry, NUCLEUS.v + z * rad * NUCLEUS.rv, NUC, shell ? 0.11 : 0.065 + 0.065 * clump, shell ? 0.52 : 0.72);
  }
  const nucleoli = [[-9, 0, 5, 4.2], [8, 1, -6, 3.4], [2, -1, 9, 2.6]];
  for (const [a, b, c, s] of nucleoli) for (let i = 0; i < 420 * cf; i++)
    cloud.add(NUCLEUS.u + a + gauss() * s * 0.6, NUCLEUS.y + b + gauss() * s * 0.3, NUCLEUS.v + c + gauss() * s * 0.6, [0.70, 0.48, 0.96], 0.10, 0.52);
  // 膜：輪廓比較亮（側面看到的膜疊得多），背側表面稀疏
  const ne = Math.round(26000 * cf);
  for (let i = 0; i < ne; i++) {
    const u = (r() * 2 - 1) * L, w = cellW(u), s = r() < 0.5 ? -1 : 1;
    const vn = s * (1 - Math.abs(gauss()) * 0.035);
    cloud.add(u, r() * 1.2 * (0.35 + 0.65 * (1 - Math.abs(u) / L)) + 0.1, cellV0(u) + vn * w, MEMB, 0.15, 0.38);
  }
  const ns = Math.round(26000 * cf);
  for (let i = 0; i < ns; i++) {
    const u = gauss() * 95; if (Math.abs(u) > L) continue;
    const vn = (r() * 2 - 1), w = cellW(u);
    cloud.add(u, cellH(u, vn), cellV0(u) + vn * w, MEMB, 0.07, 0.44);
  }
  // 細胞質裡的囊泡與內質網顆粒：核周最密
  const nc = Math.round(24000 * cf);
  for (let i = 0; i < nc; i++) {
    const u = gauss() * 70; if (Math.abs(u) > L) continue;
    const vn = gauss() * 0.55; if (Math.abs(vn) > 0.95) continue;
    const big = r() < 0.06;
    cloud.add(u, r() * cellH(u, vn), cellV0(u) + vn * cellW(u), CYTO, big ? 0.16 : 0.055, big ? 0.78 : 0.40);
  }
  const ptsMat = bokehMaterial(shared, { opacity: 1, maxPx: quality.tier === 'low' ? 16 : 22 });
  const points = cloud.build(ptsMat); points.renderOrder = 5;
  group.add(points);

  // 薄膜殼：背側表面，掠射角發亮
  const NU = quality.tier === 'low' ? 140 : 300, NV = 22;
  const pos = new Float32Array((NU + 1) * (NV + 1) * 3), idx = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const u = (i / NU * 2 - 1) * L * 0.995, vn = Math.sin((j / NV - 0.5) * Math.PI) * 0.999;
    cellToWorld(u, cellH(u, vn), cellV0(u) + vn * cellW(u), pos, (i * (NV + 1) + j) * 3);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      uniform float uOpacity; varying vec3 vW, vN;
      void main(){
        vec3 rd = normalize(vW - cameraPosition); vec3 n = normalize(vN + vec3(1e-5));
        float fr = pow(1. - abs(dot(n, rd)), 2.2);
        vec3 irid = .5 + .5 * cos(6.283 * (fr * 1.1 + vec3(0., .33, .67)));
        float l = max(dot(n, normalize(vec3(.4, .9, .5))), 0.);
        vec3 c = vec3(.020, .062, .078) * (.32 + .78 * l) + mix(vec3(.07, .24, .29), irid * .22, .3) * fr;
        gl_FragColor = vec4(c * uOpacity, 1.);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(sg, shellMat); shell.frustumCulled = false; shell.renderOrder = 2;
  group.add(shell);

  const nucleusPos = new THREE.Vector3(); { const a = [0, 0, 0]; cellToWorld(NUCLEUS.u, NUCLEUS.y + NUCLEUS.ry * 0.3, NUCLEUS.v, a); nucleusPos.fromArray(a); }
  return {
    group, nucleusPos,
    setFade(k, shellK = k) { group.visible = k > 0.002; ptsMat.uniforms.uOpacity.value = k; shellMat.uniforms.uOpacity.value = shellK; shell.visible = shellK > 0.002; },
  };
}
