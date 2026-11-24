// origin 章共用的 GLSL 與材質工廠
import * as THREE from 'three';

// 所有材質共用同一組 uniform 物件（改一次全部生效）
export function makeShared() {
  return {
    uE: { value: new THREE.Vector4(0, 5, 0, 1) },
    uHero: { value: 1 }, uSide: { value: 0 }, uP: { value: 0 }, uTime: { value: 0 },
    uFogStart: { value: 8 }, uFogDen: { value: 0.08 },
    uPx: { value: 1000 }, uFocus: { value: 8 }, uAp: { value: 0.01 },
  };
}

export const COMMON = /* glsl */`
uniform vec4 uE;
uniform float uHero, uSide, uP, uTime, uFogStart, uFogDen;
vec3 fogColor(vec3 rd){
  float a = smoothstep(-.3, .35, rd.y);
  vec3 cyt = vec3(.015, .010, .030), ext = vec3(.004, .011, .015);
  vec3 c = mix(cyt, ext, a);
  c = mix(c, vec3(.006, .018, .024) * (1. + .5 * max(rd.x, 0.)), uSide * .85);
  return c;
}
float fogF(float dist){ return exp(-max(dist - uFogStart, 0.) * uFogDen); }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

// 散景點：加色混合，靠失焦半徑做景深
export function bokehMaterial(shared, { opacity = 1, maxPx = 40, kill = 0, jitter = 0, flow = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: opacity }, uMaxPx: { value: maxPx }, uKill: { value: kill }, uJit: { value: jitter }, uFlow: { value: flow } },
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute vec2 aSz;
      uniform float uPx, uFocus, uAp, uOpacity, uMaxPx, uKill, uJit, uFlow;
      ${COMMON}
      varying vec4 vCol; varying float vSoft;
      void main(){
        vec3 p = position;
        p += uJit * sin(uTime * (.5 + aSz.y * 1.1) + aSz.y * vec3(261., 457., 119.));
        float a = uOpacity;
        if (uFlow > 0.) p.x = mod(p.x + uFlow * uTime * (.5 + aSz.y) + 34., 96.) - 34.;
        if (uKill > 0.) a *= smoothstep(uE.w + .06, uE.w + .2, length(p - uE.xyz));
        vec4 mv = viewMatrix * vec4(p, 1.);
        float dist = max(-mv.z, .02);
        float base = aSz.x * uPx / dist;
        float coc = uAp * abs(dist - uFocus) / dist * uPx;
        float s = base + coc, sz = clamp(s, 1., uMaxPx);
        float e = min(base / sz, 1.); e = e * e;
        float cap = clamp(uMaxPx / max(s, 1.), .18, 1.);
        a *= min(1., pow(e, .8)) * cap * smoothstep(.0, 1., dist / max(uFocus * .18, .01));
        a *= mix(1., fogF(dist) * fogF(dist), uHero);
        vCol = vec4(aCol, a); vSoft = clamp(2.2 / sz, .1, 1.);
        gl_PointSize = sz * 2.;
        gl_Position = projectionMatrix * mv;
        if (a < .002) gl_Position = vec4(2., 2., 2., 1.);
      }`,
    fragmentShader: /* glsl */`
      varying vec4 vCol; varying float vSoft;
      void main(){
        float r = length(gl_PointCoord - .5) * 2.;
        float a = smoothstep(1., 1. - vSoft, r);
        a *= mix(1., .75 + .45 * smoothstep(.5, 1., r), 1. - vSoft); // 大散景帶一點亮邊
        gl_FragColor = vec4(vCol.rgb, vCol.a * a);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  });
}

// 有光照的胞器材質（支援 InstancedMesh）；FLOW＝胞外液流漂移
export function organelleMaterial(shared, { color = '#ffffff', pearl = 0.6, stripe = 0, stripeFreq = 10, flow = false, emissive = 0, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uCol: { value: new THREE.Color(color) }, uPearl: { value: pearl }, uStripe: { value: stripe }, uStripeF: { value: stripeFreq }, uEmis: { value: emissive } },
    defines: flow ? { FLOW: 1 } : {},
    side,
    transparent: true,
    depthWrite: true,
    vertexShader: /* glsl */`
      ${COMMON}
      uniform float uStripeF;
      #ifdef FLOW
      attribute vec4 aFlow;
      #endif
      varying vec3 vW, vN, vC; varying float vS;
      void main(){
        vec4 w = vec4(position, 1.); vec3 n = normal; vC = vec3(1.); float len = 1.;
        #ifdef USE_INSTANCING
          len = length(instanceMatrix[1].xyz);
          #ifdef FLOW
            float gate = smoothstep(aFlow.z, aFlow.z + .09, uP);
            w.xyz *= smoothstep(0., .25, gate);
          #endif
          w = instanceMatrix * w; n = mat3(instanceMatrix) * n;
          #ifdef FLOW
            float x0 = w.x + aFlow.x * uTime;
            w.x = mod(x0 + 34., 92.) - 34. - (1. - gate) * 95. * aFlow.w;
            w.y += .25 * sin(uTime * .35 + aFlow.y * 6.283) + .12 * sin(uTime * .9 + aFlow.y * 40.);
            w.z += .2 * sin(uTime * .28 + aFlow.y * 17.);
          #endif
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        w = modelMatrix * w;
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vS = position.y * len * uStripeF;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      uniform vec3 uCol; uniform float uPearl, uStripe, uEmis;
      varying vec3 vW, vN, vC; varying float vS;
      void main(){
        if (uHero < .01) discard;
        vec3 v = vW - cameraPosition; float dist = length(v); vec3 rd = v / max(dist, 1e-4);
        vec3 n = normalize(vN + vec3(1e-5)); if (dot(n, rd) > 0.) n = -n;
        float d1 = pow(max(dot(n, normalize(vec3(.4, .9, .5))) * .5 + .5, 0.), 1.6);
        float d2 = max(dot(n, normalize(vec3(-.3, -.7, .6))) * .5 + .5, 0.);
        vec3 alb = uCol * vC * (1. - uStripe * (.5 + .5 * sin(vS)));
        float fr = pow(1. - max(dot(n, -rd), 0.), 3.);
        vec3 irid = .5 + .5 * cos(6.283 * (fr * 1.2 + vec3(0., .33, .67)));
        vec3 col = alb * (.12 + uEmis + .62 * d1 * vec3(1., .97, .92) + .26 * d2 * vec3(.5, .8, .95));
        col += mix(vec3(.8, .95, 1.), irid, .4) * fr * uPearl;
        col = mix(fogColor(rd), col, fogF(dist));
        gl_FragColor = vec4(col, uHero);
      }`,
  });
}
