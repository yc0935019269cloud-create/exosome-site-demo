// 第一章：外泌體特寫與剖面。p 0–0.28 全貌 → 0.28–0.72 剖開、看膜斷面與腔內 → 0.72–1 合攏縮成小珍珠。
import * as THREE from 'three';
import { createVesicle, createBokeh, createBackdrop } from '../lib/vesicle-kit.js';

const V3 = THREE.Vector3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;

export async function createChapter({ quality, touch, reduced }) {
  const low = quality.tier === 'low';
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#07090c');
  const FOV = 32, tanH = Math.tan(FOV * Math.PI / 360);
  const camera = new THREE.PerspectiveCamera(FOV, 1.78, .05, 300);

  // 裁切：沿著以 n 為軸的圓錐面切（脂質長軸永遠躺在切面上，斷面才乾淨）；最後停在幾乎對半
  const CUT_H = .04, CARGO_DROP = .07;
  const n0 = new V3(-.3, .42, .86).normalize();
  // rho0：切環最高點方向（與 vesicle-kit 內的定義一致）；tau0 在畫面左
  const rho0 = new V3(0, 1, 0).addScaledVector(n0, -n0.y).normalize(), tau0 = new V3().crossVectors(n0, rho0).normalize();
  const at = (a, b, c) => new V3().addScaledVector(n0, a).addScaledVector(tau0, b).addScaledVector(rho0, c);
  const ves = createVesicle({ tier: quality.tier, cutN: n0, cutH: CUT_H, cargoHero: { rna: at(-.1, .07, .07), blob: at(-.09, -.08, -.1), blob2: at(-.115, -.2, -.04) } });
  const U = ves.uniforms, group = ves.group;
  scene.add(group);

  const backdrop = createBackdrop(); scene.add(backdrop.mesh);
  const far = createBokeh({ count: low ? 70 : 180, seed: 5, box: [46, 28, 42], center: [0, 0, -10], size: [.3, 1.5], keepOut: 4.5, gain: .9 });
  const dust = createBokeh({ count: low ? 140 : 520, seed: 9, box: [9, 6, 8], center: [0, 0, -1], size: [.011, .04], keepOut: 1.3, gain: 1.5, tint: [.8, .84, .86] });
  dust.uniforms.uMaxCoc.value = .45;
  far.mesh.renderOrder = 8; dust.mesh.renderOrder = 9;
  scene.add(far.mesh, dust.mesh);

  const labels = [
    { id: 'bilayer', pos: new V3(), p: [.385, .53], side: 'left' },
    { id: 'cd63', pos: new V3(), p: [.39, .53], side: 'right' },
    { id: 'cd9', pos: new V3(), p: [.395, .53], side: 'left' },
    { id: 'cd81', pos: new V3(), p: [.4, .53], side: 'right' },
    { id: 'rna', pos: new V3(), p: [.555, .7], side: 'left' },
    { id: 'cargo', pos: new V3(), p: [.565, .7], side: 'right' },
  ];
  const L = { aspect: 1.78, vh: 810, kSide: 1, kPort: 0, d0: 4.6, panX: .8, panY: 0, dA: .46, dB: .5 };
  function resize(w, h) {
    const a = w / h; L.aspect = a; L.vh = h;
    L.kSide = smooth(.95, 1.45, a); L.kPort = 1 - smooth(.75, 1.1, a);
    const rNy = Math.min(.78, a * lerp(.86, .47, L.kSide));
    L.d0 = 1 / Math.sin(Math.atan(rNy * tanH));
    L.panX = .34 * L.kSide * L.d0 * tanH * a; L.panY = .36 * (1 - L.kSide) * L.d0 * tanH;
    // 剖面距離：橫式要容得下三顆蛋白與兩側標註；直式把膜轉成直的，蛋白上下排開
    L.dA = lerp(Math.max(.85, .7 / (2 * tanH * a)), 1.2, L.kPort);
    L.dB = lerp(.5, .9, L.kPort);
    backdrop.uniforms.uAspect.value = a;
    const port = L.kPort > .5;
    // 橫式：cd9 在最左字往左，其餘往右；直式：胞外在左，四個標註都往左排進暗場
    labels[0].side = 'left'; labels[2].side = 'left'; labels[1].side = labels[3].side = port ? 'left' : 'right';
    labels[4].side = port ? 'right' : 'left'; labels[5].side = port ? 'left' : 'right';
  }

  const nW = new V3(), rhoW = new V3(), tauW = new V3(), P0 = new V3(), Tc = new V3();
  const pos = new V3(), tgt = new V3(), up = new V3(), k0p = new V3(), k0t = new V3(), aP = new V3(), aT = new V3(), aU = new V3(), bP = new V3(), tmp = new V3(), tmp2 = new V3();
  const yUp = new V3(0, 1, 0), qInv = new THREE.Quaternion();
  // 指標：凹陷用彈簧（放開會回彈過頭再穩定），移動時丟出漣漪
  const hit = { dir: new V3(0, 0, 1), w: 0, v: 0, on: false, last: new V3(0, 0, 1), cool: 0, idx: 0, moved: false };

  function update(p, t, dt, ptr) {
    const amb = reduced ? .3 : 1;
    const open = smooth(.28, .38, p) * (1 - smooth(.72, .83, p));
    const w1 = smooth(.32, .4, p), w2 = smooth(.5, .57, p), w3 = smooth(.69, .78, p), w4 = smooth(.76, .95, p);
    const closeK = w1 * (1 - w3);
    U.uTime.value = t; U.uJit.value = amb; U.uWob.value = lerp(1, .4, closeK) * (reduced ? .4 : 1);
    U.uCut.value.w = lerp(1.03, CUT_H, open);
    U.uCutC.value.w = U.uCut.value.w - CARGO_DROP - (1 - open) * .12;
    ves.setOpen(open > 0);

    group.rotation.set(.02 * Math.sin(t * .13) * amb * (1 - closeK), -.5 * (1 - smooth(0, .3, p)) + .8 * smooth(.74, 1, p) + .035 * Math.sin(t * .17) * amb * (1 - closeK), 0);
    group.updateMatrixWorld();
    nW.copy(ves.n).applyQuaternion(group.quaternion); rhoW.copy(ves.rho).applyQuaternion(group.quaternion); tauW.copy(ves.tau).applyQuaternion(group.quaternion);

    // 全貌（結尾拉遠、置中）
    const d = Math.exp(lerp(Math.log(L.d0 * (1.07 - .07 * smooth(0, .3, p))), Math.log(60), w4)), pan = 1 - w4;
    k0t.set(-L.panX * pan, -L.panY * pan, 0); k0p.set(k0t.x + ptr.x * .06 * pan, k0t.y + ptr.y * .04 * pan, d);
    pos.copy(k0p); tgt.copy(k0t); up.copy(yUp);
    // 膜斷面：正對切面，胞外朝上（暗場襯出胞外環）、腔內朝下；鏡頭略偏腔內側，切緣後方的膜面才不會搶戲
    P0.copy(rhoW).multiplyScalar(ves.RMID);
    aP.copy(P0).addScaledVector(nW, L.dA).addScaledVector(rhoW, -.1 * L.dA).addScaledVector(tauW, (p - .46) * .3);
    aT.copy(P0).addScaledVector(rhoW, lerp(.03, .06, L.kPort)).addScaledVector(tauW, (p - .46) * .18);
    // 直式：膜轉成直的，胞外暗場在左（左下的章節文字才壓在暗處），腔內在右
    aU.copy(rhoW).multiplyScalar(1 - L.kPort).addScaledVector(tauW, -L.kPort).normalize();
    pos.lerp(aP, w1); tgt.lerp(aT, w1); up.lerp(aU, w1);
    // 腔內：越過切緣，貼近貨物
    ves.cargoPos(ves.cargoHeroes.rna, t, labels[4].pos); ves.cargoPos(ves.cargoHeroes.cargo, t, labels[5].pos);
    Tc.copy(labels[4].pos).lerp(labels[5].pos, .5).applyMatrix4(group.matrixWorld);
    tmp.copy(nW).multiplyScalar(.74).addScaledVector(rhoW, .6).addScaledVector(tauW, -.2 + (p - .62) * .8).normalize();
    bP.copy(Tc).addScaledVector(tmp, L.dB);
    pos.lerp(bP, w2); tgt.lerp(Tc, w2); up.lerp(yUp, w2);
    pos.lerp(k0p, w3); tgt.lerp(k0t, w3); up.lerp(yUp, w3);
    camera.position.copy(pos); camera.up.copy(up.normalize()); camera.lookAt(tgt);
    const dc = pos.length();
    camera.near = clamp((dc - 1.4) * .5, .02, 8); camera.far = dc + 140; camera.updateProjectionMatrix(); camera.updateMatrixWorld();

    // 遠距 LOD：顆粒小於一個像素前換成平滑珍珠
    const rpx = dc > 1.02 ? L.vh * .5 * Math.tan(Math.asin(1 / dc)) / tanH : 1e4;
    const pearl = 1 - smooth(55, 150, rpx);
    U.uPearl.value = pearl; U.uProt.value = 1 - smooth(0, .8, pearl); U.uSheen.value = lerp(1, .5, closeK);
    ves.setDetail(pearl < .999);
    // 霧色貼近暗場底色；特寫時從對焦面之後開始收暗，做出景深層次
    const dClose = lerp(L.dA, L.dB, w2);
    U.uFogStart.value = lerp(Math.max(dc - .2, 0), dClose * .96, closeK);
    U.uFog.value.set(.006, .0075, .011, lerp(.45, 2.6, closeK));

    // 指標打球面
    if (!hit.moved && (ptr.x !== 0 || ptr.y !== 0)) hit.moved = true;
    const ow = 1 - smooth(.22, .29, p);
    let on = false;
    if (hit.moved && ow > 0 && (!touch || ptr.down)) {
      tmp.set(ptr.x, ptr.y, .5).unproject(camera).sub(pos).normalize();
      const b = pos.dot(tmp), disc = b * b - (pos.lengthSq() - 1);
      if (disc > 0 && -b - Math.sqrt(disc) > 0) {
        tmp2.copy(pos).addScaledVector(tmp, -b - Math.sqrt(disc)).normalize().applyQuaternion(qInv.copy(group.quaternion).invert());
        on = true;
        if (!hit.on) hit.dir.copy(tmp2); else hit.dir.lerp(tmp2, 1 - Math.exp(-dt * 14)).normalize();
        hit.cool -= dt;
        if ((!hit.on || hit.last.distanceTo(tmp2) > .2) && hit.cool <= 0) { U.uRip.value[hit.idx].set(tmp2.x, tmp2.y, tmp2.z, .001); hit.idx = (hit.idx + 1) % 4; hit.last.copy(tmp2); hit.cool = .16; }
      }
    }
    hit.on = on;
    const sdt = Math.min(dt, .033);
    hit.v += ((on ? ow : 0) - hit.w) * 90 * sdt - hit.v * 8 * sdt; hit.w += hit.v * sdt;
    U.uHit.value.set(hit.dir.x, hit.dir.y, hit.dir.z, hit.w);
    for (const r of U.uRip.value) if (r.w > 0) { r.w += dt; if (r.w > 4.5) r.w = -1; }

    // 標註錨點（跟著膜的起伏與貨物漂動）
    const wob = U.uWob.value * .013;
    for (const [i, key] of [[0, 'bilayer'], [1, 'cd63'], [2, 'cd9'], [3, 'cd81']]) {
      const h = ves.heroes[key]; tmp.copy(h).normalize();
      labels[i].pos.copy(h).addScaledVector(tmp, wob * ves.wave(tmp, t)).applyMatrix4(group.matrixWorld);
    }
    labels[4].pos.applyMatrix4(group.matrixWorld); labels[5].pos.applyMatrix4(group.matrixWorld);

    // 景深與底色
    const focus = tmp.copy(tgt).sub(pos).length();
    far.uniforms.uTime.value = dust.uniforms.uTime.value = t * amb;
    far.uniforms.uFocus.value = dust.uniforms.uFocus.value = focus;
    far.uniforms.uAperture.value = .2; dust.uniforms.uAperture.value = .16;
    dust.uniforms.uGain.value = 1.5 * (1 - w4);
    tmp.set(0, 0, 0).project(camera);
    backdrop.uniforms.uA.value.set(clamp(tmp.x, -1.2, 1.2), clamp(tmp.y, -1.2, 1.2), lerp(1.05, 1.6, closeK));
    backdrop.uniforms.uB.value.set(-.55, -.7, 1.1);
  }

  resize(1440, 810);
  return {
    scene, camera, labels, update, resize,
    theme: () => 0,
    bloom: () => ({ strength: .45, radius: .62, threshold: .92 }),
    info: () => ({ lipids: ves.nLipids, proteins: ves.nProteins, cargo: ves.nCargo, tris: ves.tris }),
  };
}
