// 主角：raymarch 一個「細胞質」純量場 d（<0 在細胞質內）。膜 = |d| < H 的殼。
// 胞外與內體腔都是 d>0，ILV 內部是 d<0，所以膜的拓樸（哪一面朝細胞質）由同一個場自動保證。
import * as THREE from 'three';
import { COMMON } from './glsl.js';
import { N_ILV } from './path.js';

export function createHero(shared, quality) {
  const steps = quality.tier === 'low' ? 52 : 80;
  const uniforms = {
    ...shared,
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
    uG: { value: new THREE.Vector4(0, 0, 0, -1) },
    uI: { value: Array.from({ length: N_ILV }, () => new THREE.Vector4(0, 0, 0, -1)) },
    uCoat: { value: 0 }, uAspect: { value: 1.7 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vNdc;
      void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      uniform mat4 uInvProj, uCamWorld, uViewProj;
      uniform vec4 uG, uI[${N_ILV}];
      uniform float uCoat, uAspect;
      varying vec2 vNdc;
      const float H = .03;
      float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
      float smax(float a, float b, float k){ return -smin(-a, -b, k); }
      float cyt(vec3 p){
        float d = p.y - .05 * sin(p.x * .55 + uTime * .22) * sin(p.z * .5 + 1.3) - .025 * sin(p.x * 1.7 - uTime * .17 + p.z * 1.3);
        d = smax(d, uE.w - length(p - uE.xyz), .3);
        float dg = length(p - uG.xyz) - uG.w;
        if (dg < 0.) {
          for (int i = 0; i < ${N_ILV}; i++) d = smin(d, length(p - uI[i].xyz) - uI[i].w, .1);
        } else d = min(d, dg + .12);
        return d;
      }
      float map(vec3 p){ return max(abs(cyt(p)) - H, p.z); }
      vec3 bgCol(vec3 rd){
        float r2 = dot(vNdc, vNdc);
        vec3 ov = vec3(.0035, .0045, .0065) + vec3(.008, .0045, .014) * max(1. - r2 * .55, 0.);
        return mix(ov, fogColor(rd), uHero);
      }
      void main(){
        vec4 vp = uInvProj * vec4(vNdc, 1., 1.);
        vec3 rd = normalize(mat3(uCamWorld) * (vp.xyz / vp.w));
        vec3 ro = uCamWorld[3].xyz;
        vec3 bg = bgCol(rd);
        gl_FragDepth = .9999999;
        if (uHero < .003) { gl_FragColor = vec4(bg, 1.); return; }
        float t0 = 0., t1 = 400.; bool ok = true;
        if (ro.z > 0.) { if (rd.z > -1e-4) ok = false; else t0 = -ro.z / rd.z; }
        else if (rd.z > 1e-4) t1 = -ro.z / rd.z;
        float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
        float ta = (-7. - ro.y) / ry, tb = (9. - ro.y) / ry;
        t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); t1 = min(t1, t0 + 70.);
        float t = t0, m = 1., minM = 10.; bool hit = false; vec3 p = ro;
        if (ok && t1 > t0) {
          for (int i = 0; i < ${steps}; i++) {
            p = ro + rd * t; m = map(p);
            minM = min(minM, m);
            if (m < .0007 * t + .0004) { hit = true; break; }
            t += m * .88;
            if (t > t1) break;
          }
        }
        vec3 col = bg;
        float glow = exp(-max(minM, 0.) * 5.);
        if (hit) {
          float d = cyt(p);
          float shell = abs(d) - H;
          vec3 c;
          if (p.z > shell - .002 && p.z > -.004 - .002 * t) {
            // 剖面：看得到雙層。朝胞外／腔的那一葉偏玉，朝細胞質的那一葉偏紫
            float x = clamp(d / H, -1., 1.);
            vec3 exo = vec3(.66, 1.05, .90), cy = vec3(.74, .58, 1.10);
            c = mix(cy, exo, smoothstep(-.12, .12, x));
            c *= .16 + .84 * smoothstep(.02, .42, abs(x));
            c *= 1.25;
          } else {
            vec2 e = vec2(1., -1.) * .0025;
            vec3 n = normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx) + vec3(1e-6));
            float side = step(0., d); // 1 = 朝胞外／腔的面
            float dI = 10.;
            for (int i = 0; i < 14; i++) dI = min(dI, abs(length(p - uI[i].xyz) - uI[i].w));
            float isV = smoothstep(.10, .035, dI);                       // 這一點在 ILV／外泌體上
            float wall = side * (1. - isV) * smoothstep(.16, .04, abs(length(p - uE.xyz) - uE.w)); // 腔的內壁
            vec3 alb = mix(vec3(.36, .28, .62), vec3(.36, .60, .55), side);
            alb = mix(alb, vec3(.80, .93, .86), isV);
            vec3 pl = p - uE.xyz * smoothstep(uE.w + .7, uE.w + .15, length(p - uE.xyz)); // 內體附近的花紋跟著內體走
            float mo = sin(pl.x * 9. + sin(pl.z * 7. + pl.y * 3.)) * sin(pl.y * 8. + sin(pl.x * 6.)) * sin(pl.z * 9.5 + sin(pl.y * 5.));
            alb *= .9 + .12 * mo;
            // 膜蛋白斑點（CD63 玉色為主），貼在膜面上隨膜走
            vec3 q = pl * 5.5; vec3 qi = floor(q), qf = fract(q) - .5;
            float hs = hash21(qi.xy + qi.z * 17.3);
            float spot = smoothstep(.34, .18, length(qf)) * step(.62, hs);
            alb = mix(alb, mix(vec3(.25, .78, .69), vec3(.95, .72, .30), step(.9, hs)) * 1.25, spot * .7);
            float ao = clamp(.3 + .7 * (map(p + n * .1) / .1 * .5 + map(p + n * .28) / .28 * .5), 0., 1.);
            float d1 = pow(max(dot(n, normalize(vec3(.4, .9, .5))) * .5 + .5, 0.), 1.5);
            float d2 = max(dot(n, normalize(vec3(-.3, -.7, .6))) * .5 + .5, 0.);
            float fr = pow(1. - max(dot(n, -rd), 0.), 4.);
            vec3 irid = .5 + .5 * cos(6.283 * (fr * 1.3 + mo * .08 + vec3(0., .33, .67)));
            c = alb * (.12 + .62 * d1 * vec3(1., .97, .92) + .26 * d2 * vec3(.5, .8, .95)) * ao;
            c += mix(vec3(.8, .95, 1.), irid, .42) * fr * (.35 + .65 * ao) * (.3 + .8 * isV) * (.8 + .4 * mo);
            c *= 1. - .5 * wall;
            float sp = pow(max(dot(reflect(rd, n), normalize(vec3(.4, .9, .5))), 0.), 40.);
            c += sp * .5 * ao;
          }
          float patchF = 1. - smoothstep(22., 38., length(p.xz - vec2(3., -6.)));
          float k = fogF(t) * patchF;
          col = mix(bg, c, k * uHero);
          if (k * uHero > .35) {
            vec4 cp = uViewProj * vec4(p, 1.);
            gl_FragDepth = clamp(cp.z / cp.w * .5 + .5, 0., .9999999);
          }
        }
        col += vec3(.10, .16, .20) * glow * glow * .05 * uHero;
        gl_FragColor = vec4(max(col, 0.), 1.);
      }`,
    depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -100;
  return {
    mesh, uniforms,
    sync(camera) {
      uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
      uniforms.uCamWorld.value.copy(camera.matrixWorld);
      uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    },
  };
}
