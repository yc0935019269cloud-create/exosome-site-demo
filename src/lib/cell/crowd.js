// 擁擠的細胞質：核糖體（含多核糖體串）、微管、皮層肌動蛋白、其他囊泡與粒線體、馬達蛋白；以及胞外隨液流漂的外泌體群
import * as THREE from 'three';
import { bokehMaterial, organelleMaterial, COMMON } from './glsl.js';
import { rng, TRACK, smooth } from './path.js';

export function createCrowd(shared, quality) {
  const low = quality.tier === 'low', cf = low ? 0.3 : 1;
  const r = rng(555), group = new THREE.Group();
  const gauss = () => (r() + r() + r() + r() - 2) * 0.87;
  const tmp = new THREE.Object3D();

  // ── 核糖體與可溶蛋白霧（點）
  {
    const max = Math.round(46000 * cf), pos = new Float32Array(max * 3), col = new Float32Array(max * 3), sz = new Float32Array(max * 2); let n = 0;
    const put = (x, y, z, c, k, s) => {
      if (n >= max || y > -0.2 || y < -10) return;
      if (z > 0.25 && r() > 0.22) return;
      pos.set([x, y, z], n * 3); col.set([c[0] * k, c[1] * k, c[2] * k], n * 3); sz[n * 2] = s; sz[n * 2 + 1] = r(); n++;
    };
    const RIBO = [0.42, 0.70, 0.72], HAZE = [0.42, 0.30, 0.72];
    const X = () => -16 + r() * 34, Y = () => -0.25 - Math.pow(r(), 0.8) * 9.5, Z = () => 2.6 - Math.pow(r(), 0.75) * 16;
    while (n < max * 0.5) { // 多核糖體：沿 mRNA 排成彎曲的一串
      let x = X(), y = Y(), z = Z(), a = r() * 6.28, b = (r() - 0.5) * 2; const len = 5 + r() * 9 | 0, k = 0.5 + r() * 0.5;
      for (let i = 0; i < len; i++) {
        a += 0.55 + gauss() * 0.3; b += gauss() * 0.3;
        x += Math.cos(a) * 0.1; z += Math.sin(a) * 0.1; y += Math.sin(b) * 0.06;
        put(x, y, z, RIBO, 0.075 * k, 0.042);
      }
    }
    while (n < max * 0.82) put(X(), Y(), Z(), RIBO, 0.04 + r() * 0.035, 0.04);
    let guard = 0;
    while (n < max && guard++ < max * 4) put(X(), Y(), Z(), HAZE, 0.008 + r() * 0.008, 0.1 + r() * 0.16);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col.subarray(0, n * 3), 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(sz.subarray(0, n * 2), 2));
    const m = new THREE.Points(g, bokehMaterial(shared, { opacity: 1, maxPx: low ? 22 : 34, kill: 1, jitter: 0.012 }));
    m.frustumCulled = false; m.renderOrder = 6; group.add(m);
    group.userData.ribo = m;
  }

  // ── 微管：25 nm 管，從核側（左、深處）往周邊輻射
  const tubeGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 8, 1, true);
  const mtMat = organelleMaterial(shared, { color: '#8fb7b4', pearl: 0.35, stripe: 0.3, stripeFreq: 39 });
  {
    const n = Math.round(34 * (low ? 0.5 : 1)), im = new THREE.InstancedMesh(tubeGeo, mtMat, n + 1);
    const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const z = -1.9 - Math.pow(r(), 1.2) * 11, len = 24 + r() * 16;
      d.set(1, (r() - 0.5) * 0.34, (r() - 0.5) * 0.45).normalize();
      const maxY = -0.6 - Math.abs(d.y) * (len * 0.5);
      const y = Math.min(-1.2 - r() * 7.5, maxY);
      tmp.position.set(-6 + r() * 12, y, z); tmp.quaternion.setFromUnitVectors(up, d); tmp.scale.set(1, len, 1); tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
    }
    // 主角的軌道
    d.set(TRACK.tx, TRACK.ty, 0); tmp.position.set(TRACK.ox - TRACK.tx * 7, TRACK.oy - TRACK.ty * 7, TRACK.z); tmp.quaternion.setFromUnitVectors(up, d); tmp.scale.set(1, 34, 1); tmp.updateMatrix();
    im.setMatrixAt(n, tmp.matrix);
    im.frustumCulled = false; group.add(im);
  }

  // ── 其他囊泡、內體、溶酶體（珍珠膜球）
  const sphGeo = new THREE.IcosahedronGeometry(1, low ? 2 : 3);
  {
    const n = Math.round(150 * cf), im = new THREE.InstancedMesh(sphGeo, organelleMaterial(shared, { color: '#7d88b8', pearl: 0.55 }), n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const big = r() < 0.07, rad = big ? 0.7 + r() * 0.6 : 0.1 + Math.pow(r(), 2) * 0.4;
      const z = -(big ? 3.6 : 1.9) - Math.pow(r(), 1.1) * 11;
      tmp.position.set(-15 + r() * 32, -0.6 - rad - r() * 8, z); tmp.quaternion.identity(); tmp.scale.setScalar(rad); tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
      const h = r(); c.setRGB(0.55 + 0.3 * h, 0.75 + 0.2 * r(), 0.85 + 0.25 * (1 - h)); im.setColorAt(i, c);
    }
    im.frustumCulled = false; group.add(im);
  }

  // ── 粒線體（背景的大傢伙，給尺度）
  {
    const mat = organelleMaterial(shared, { color: '#a8517c', pearl: 0.4, stripe: 0.35, stripeFreq: 8 });
    const n = low ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const p0 = new THREE.Vector3(-13 + i * 5.2 + r() * 2, -2.6 - r() * 5.5, -4.4 - r() * 6.5), pts = [p0.clone()];
      let a = (r() - 0.5) * 1.2;
      for (let k = 0; k < 4; k++) { a += gauss() * 0.5; p0.x += Math.cos(a) * 1.7; p0.y += Math.sin(a) * 1.7; p0.z += gauss() * 0.5; pts.push(p0.clone()); }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.62, 12, false);
      // 兩端封圓：把頭尾幾圈往軸心收
      const ps = geo.attributes.position, ring = 13, rows = 41;
      for (let row = 0; row < rows; row++) {
        const e = Math.min(row, rows - 1 - row) / 3; if (e >= 1) continue;
        const s = Math.sqrt(1 - (1 - e) * (1 - e)) * 0.98 + 0.02, cpt = new THREE.Vector3();
        for (let j = 0; j < ring; j++) cpt.add(new THREE.Vector3().fromBufferAttribute(ps, row * ring + j));
        cpt.multiplyScalar(1 / ring);
        for (let j = 0; j < ring; j++) { const v = new THREE.Vector3().fromBufferAttribute(ps, row * ring + j).sub(cpt).multiplyScalar(s).add(cpt); ps.setXYZ(row * ring + j, v.x, v.y, v.z); }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; group.add(m);
    }
  }

  // ── 皮層肌動蛋白網（膜下細絲）
  {
    const n = Math.round(1500 * cf), pos = new Float32Array(n * 6), al = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = -16 + r() * 34, z = 1.2 - Math.pow(r(), 0.8) * 13, y = -0.13 - Math.pow(r(), 1.6) * 0.75, a = r() * 6.28, l = 0.5 + r() * 1.3;
      pos.set([x, y, z, x + Math.cos(a) * l, Math.min(y + gauss() * 0.22, -0.11), z + Math.sin(a) * l], i * 6);
      al[i * 2] = al[i * 2 + 1] = 0.4 + r() * 0.6;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: /* glsl */`${COMMON} attribute float aA; varying float vA;
        void main(){ vec4 mv = viewMatrix * vec4(position, 1.); float dist = -mv.z;
          vA = aA * fogF(dist) * uHero * smoothstep(uE.w + .1, uE.w + .45, length(position - uE.xyz)) * smoothstep(.3, 2., dist);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`varying float vA; void main(){ gl_FragColor = vec4(vec3(.16, .62, .52) * vA * .5, 1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.LineSegments(g, mat); m.frustumCulled = false; m.renderOrder = 4; group.add(m);
  }

  // ── 馬達蛋白（kinesin 意象）：兩個頭交替踏步、一根柄接到 MVB
  const motors = [];
  {
    const headGeo = new THREE.IcosahedronGeometry(0.052, 2), stalkGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 6);
    const mat = organelleMaterial(shared, { color: '#c9a070', pearl: 0.3, emissive: 0.25 });
    for (let j = 0; j < 3; j++) {
      const o = { off: (j - 1) * 0.42, h1: new THREE.Mesh(headGeo, mat), h2: new THREE.Mesh(headGeo, mat), s: new THREE.Mesh(stalkGeo, mat), ph: j * 0.37 };
      for (const m of [o.h1, o.h2, o.s]) { m.frustumCulled = false; group.add(m); }
      motors.push(o);
    }
  }
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function updateMotors(p, E) {
    const k = smooth(0.5, 0.535, p) * (1 - smooth(0.68, 0.705, p));
    const l = (E.x - TRACK.ox) * TRACK.tx + (E.y - TRACK.oy) * TRACK.ty, step = 0.17;
    for (const o of motors) {
      const vis = k > 0.01; o.h1.visible = o.h2.visible = o.s.visible = vis; if (!vis) continue;
      const ph = (l + o.off) / (2 * step) + o.ph, n = Math.floor(ph), f = ph - n;
      const a1 = 2 * step * (n + smooth(0, 0.5, f)) - o.ph * 2 * step, a2 = 2 * step * (n + smooth(0.5, 1, f)) + step - o.ph * 2 * step;
      const l1 = Math.sin(Math.PI * smooth(0, 0.5, f)) * 0.07, l2 = Math.sin(Math.PI * smooth(0.5, 1, f)) * 0.07;
      const lift = 0.085;
      o.h1.position.set(TRACK.ox + TRACK.tx * a1 + TRACK.nx * (lift + l1), TRACK.oy + TRACK.ty * a1 + TRACK.ny * (lift + l1), TRACK.z + 0.03);
      o.h2.position.set(TRACK.ox + TRACK.tx * a2 + TRACK.nx * (lift + l2), TRACK.oy + TRACK.ty * a2 + TRACK.ny * (lift + l2), TRACK.z - 0.03);
      o.h1.scale.setScalar(k); o.h2.scale.setScalar(k);
      va.copy(o.h1.position).add(o.h2.position).multiplyScalar(0.5); va.x += TRACK.nx * 0.05; va.y += TRACK.ny * 0.05;
      // 貨物端：MVB 表面朝軌道的那一點（略為錯開）
      vb.set(E.x + o.off * 0.55 * TRACK.tx - TRACK.nx * E.w * 0.96, E.y + o.off * 0.55 * TRACK.ty - TRACK.ny * E.w * 0.96, E.z);
      vd.subVectors(vb, va); const len = Math.max(vd.length(), 1e-3);
      o.s.position.copy(va).addScaledVector(vd, 0.5); o.s.quaternion.setFromUnitVectors(UP, vd.multiplyScalar(1 / len)); o.s.scale.set(k, len, k);
    }
  }

  // ── 胞外：隨液流往右漂的外泌體群（珍珠白偏玉）
  {
    const n = Math.round(540 * cf), nPl = Math.round(190 * cf), mat = organelleMaterial(shared, { color: '#c4dfd4', pearl: 0.95, flow: true, emissive: 0.16 });
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, n + nPl), fl = new Float32Array((n + nPl) * 4);
    for (let i = 0; i < n; i++) {
      const rad = 0.1 + r() * 0.13, y = 0.85 + Math.pow(r(), 1.5) * 9, z = 0.3 - Math.pow(r(), 1.3) * 14;
      tmp.position.set(-34 + r() * 92, y, z); tmp.quaternion.identity(); tmp.scale.setScalar(rad); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
      fl[i * 4] = 0.5 + r() * 0.8 + y * 0.12; fl[i * 4 + 1] = r(); fl[i * 4 + 2] = r() < 0.16 ? -1 : 0.74 + r() * 0.2; fl[i * 4 + 3] = 1;
    }
    // 融合孔冒出來的那一道：沿液流往右上展開，隨 p 由近而遠出現
    for (let i = n; i < n + nPl; i++) {
      const s = Math.pow(r(), 0.8), rad = 0.1 + r() * 0.1, sp = 0.25 + s * 1.6;
      tmp.position.set(3.5 + s * 24 + gauss() * 0.5, 0.75 + 3.2 * (1 - Math.exp(-s * 3.5)) + gauss() * sp * 0.7 + sp * 0.3, -0.5 - Math.abs(gauss()) * sp * 1.4);
      if (tmp.position.y < 0.6) tmp.position.y = 0.6 + r() * 0.5;
      tmp.quaternion.identity(); tmp.scale.setScalar(rad); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
      fl[i * 4] = 0.22; fl[i * 4 + 1] = r(); fl[i * 4 + 2] = 0.775 + s * 0.14; fl[i * 4 + 3] = 0;
    }
    im.geometry.setAttribute('aFlow', new THREE.InstancedBufferAttribute(fl, 4));
    im.frustumCulled = false; group.add(im);
  }

  // 遠近景的外泌體散景（點），補足「成群」與景深
  let relMat;
  {
    const n = Math.round(2600 * cf), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      pos.set([-34 + r() * 96, 0.7 + Math.pow(r(), 1.3) * 13, 4 - Math.pow(r(), 0.9) * 26], i * 3);
      const k = 0.16 + r() * 0.2; col.set([0.72 * k, 0.95 * k, 0.86 * k], i * 3); sz[i * 2] = 0.09 + r() * 0.1; sz[i * 2 + 1] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSz', new THREE.BufferAttribute(sz, 2));
    relMat = bokehMaterial(shared, { opacity: 0, maxPx: low ? 22 : 36, jitter: 0.08, flow: 1.1 });
    const m = new THREE.Points(g, relMat); m.frustumCulled = false; m.renderOrder = 7; group.add(m);
  }

  return { group, updateMotors, setRelease(k) { relMat.uniforms.uOpacity.value = k; } };
}
