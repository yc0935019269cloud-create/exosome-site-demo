// origin 章的組裝：鏡頭、共用 uniform、標註。
// 模組：path（時間軸）、hero（raymarch 膜）、overview（細胞全貌）、crowd（細胞質與胞外）。
import * as THREE from 'three';
import { makeShared } from './glsl.js';
import { createHero } from './hero.js';
import { createOverview } from './overview.js';
import { createCrowd } from './crowd.js';
import { clamp, smooth, lerp, sample, endosome, makeILV, updateILV, makeCamKeys } from './path.js';

export async function createChapter({ renderer, quality, touch, reduced }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#07090c');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 3000);
  const shared = makeShared();
  const hero = createHero(shared, quality); scene.add(hero.mesh);
  const overview = createOverview(shared, quality); scene.add(overview.group);
  const crowd = createCrowd(shared, quality); scene.add(crowd.group);

  const ilv = makeILV(), camKeys = makeCamKeys(), ck = new Array(7).fill(0);
  const E = shared.uE.value, G = hero.uniforms.uG.value, I = hero.uniforms.uI.value;
  const target = new THREE.Vector3(), relPos = new THREE.Vector3();
  const L = {
    nucleus: { id: 'nucleus', pos: overview.nucleusPos.clone(), p: [0.03, 0.15], side: 'right' },
    endosome: { id: 'endosome', pos: new THREE.Vector3(), p: [0.31, 0.48], side: 'right' },
    mvb: { id: 'mvb', pos: new THREE.Vector3(), p: [0.50, 0.69], side: 'right' },
    fusion: { id: 'fusion', pos: new THREE.Vector3(), p: [0.71, 0.82], side: 'right' },
    release: { id: 'release', pos: new THREE.Vector3(), p: [0.83, 0.96], side: 'left' },
  };
  let vh = 810, vdpr = 1;

  function update(p, t, dt, ptr) {
    p = clamp(p);
    const amb = reduced ? 0.25 : 1, tt = t * amb;
    endosome(p, E);
    updateILV(ilv, p, tt, E, I, G, relPos, amb);

    // 鏡頭
    sample(camKeys, p, ck);
    const asp = camera.aspect, narrow = clamp((1.25 - asp) / 0.8); // 直式：拉遠並轉向
    const inHero = smooth(0.16, 0.27, p);
    const d = Math.exp(ck[3]) * (1 + narrow * lerp(0.42, 0.55, inHero));
    let az = ck[4] + narrow * (1 - inHero) * 58, el = ck[5];
    az += ((ptr?.x || 0) * 3.2 + Math.sin(tt * 0.11) * 0.9) * (0.4 + 0.6 * inHero);
    el += (-(ptr?.y || 0) * 1.8 + Math.sin(tt * 0.083 + 1) * 0.5) * (0.4 + 0.6 * inHero);
    const ra = az * Math.PI / 180, re = el * Math.PI / 180;
    target.set(ck[0], ck[1], ck[2]);
    camera.position.set(target.x + Math.sin(ra) * Math.cos(re) * d, target.y + Math.sin(re) * d, target.z + Math.cos(ra) * Math.cos(re) * d);
    camera.lookAt(target);
    camera.near = Math.max(0.05, d * 0.03); camera.far = 120 + d * 6;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    hero.sync(camera);

    const heroK = smooth(0.155, 0.215, p);
    shared.uHero.value = heroK; shared.uP.value = p; shared.uTime.value = tt;
    shared.uSide.value = smooth(-0.4, 1.2, camera.position.y) * smooth(0.7, 0.86, p);
    shared.uFocus.value = d; shared.uAp.value = ck[6];
    shared.uFogStart.value = d - 1.2; shared.uFogDen.value = lerp(0.085, 0.11, smooth(0.8, 1, p));
    shared.uPx.value = vh * vdpr / (2 * Math.tan(camera.fov * Math.PI / 360));
    const ovDist = clamp(Math.pow(Math.exp(ck[3]) / 280, 0.72), 0.14, 1);
    const ovFade = (1 - smooth(0.145, 0.225, p)) * ovDist;
    const shellFade = (1 - smooth(0.13, 0.195, p)) * ovDist * 0.85;
    overview.setFade(ovFade, shellFade);
    crowd.setRelease(heroK * (0.22 + 0.78 * smooth(0.74, 0.9, p)));
    crowd.group.visible = heroK > 0.01;
    crowd.updateMotors(p, E);

    L.endosome.pos.set(E.x + E.w * 0.75, E.y + E.w * 0.55, 0);
    L.mvb.pos.set(E.x + E.w * 0.78, E.y + E.w * 0.6, 0);
    L.fusion.pos.set(E.x + 0.75, 0.1, 0);
    L.release.pos.copy(relPos);
  }

  return {
    scene, camera,
    labels: Object.values(L),
    update,
    resize(w, h, dpr) { vh = h; vdpr = dpr; },
    theme: () => 0,
    bloom: p => ({ strength: lerp(0.24, 0.28, smooth(0.15, 0.3, p)), radius: 0.48, threshold: 0.96 }),
  };
}
