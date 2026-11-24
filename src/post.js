// 後製：兩個章節各自渲染成 HDR 貼圖，依轉場合成，再泛光、色調映射、顆粒。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const compFrag = /* glsl */`
uniform sampler2D tA,tB; uniform float uMix,uAspect,uTime; uniform int uMode; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.03+7.1; a*=.5; } return s; }
vec3 A(vec2 u){ return texture2D(tA,u).rgb; }
vec3 B(vec2 u){ return texture2D(tB,u).rgb; }
void main(){
  if(uMix<=.0001){ gl_FragColor=vec4(max(A(vUv),0.),1.); return; }
  if(uMix>=.9999){ gl_FragColor=vec4(max(B(vUv),0.),1.); return; }
  float m=uMix; vec2 c=(vUv-.5)*vec2(uAspect,1.); float r=length(c); vec3 col;
  if(uMode==0){            // 縮小：整個畫面捲進一顆囊泡，膜邊折射
    float e=1.-smoothstep(0.,1.,m); float R=e*(.62*length(vec2(uAspect,1.)));
    float wob=(fbm(c/max(r,1e-3)*2.2+uTime*.25)-.5)*.10*e*smoothstep(0.,.2,m);
    float d=r-(R+wob); float inside=1.-smoothstep(-.004,.004,d);
    float k=smoothstep(R*.35,R+.0001,r); vec2 dir=c/max(r,1e-3);
    vec2 ua=.5+(c/max(mix(1.,e,.65),.04)*mix(1.,.72,k))/vec2(uAspect,1.);
    vec2 ub=vUv-dir/vec2(uAspect,1.)*exp(-abs(d)*16.)*.05;
    float inA=smoothstep(0.,.035,ua.x)*smoothstep(1.,.965,ua.x)*smoothstep(0.,.035,ua.y)*smoothstep(1.,.965,ua.y);
    vec3 colA=mix(vec3(.0035,.0045,.0065),A(clamp(ua,.002,.998)),inA);
    col=mix(B(clamp(ub,0.,1.)),colA,inside);
    float rim=exp(-abs(d)*95.)*smoothstep(0.,.1,m)*(1.-smoothstep(.85,1.,m));
    vec3 irid=.5+.5*cos(6.283*(vec3(0.,.33,.62)+atan(c.y,c.x)*.32+r*1.6));
    col+=rim*mix(vec3(1.),irid,.65)*.58;
  } else if(uMode==1){     // 沖流：液流由左往右帶走上一景
    float w=fbm(vec2(vUv.x*2.2-uTime*.15,vUv.y*6.5+uTime*.05));
    float f=vUv.x*.62+w*.38; float t=m*1.25-.12; float e=1.-smoothstep(t-.07,t+.07,f);
    float band=exp(-abs(f-t)*20.); vec2 off=vec2(band*.07,(w-.5)*band*.06);
    col=mix(A(clamp(vUv-off,0.,1.)),B(clamp(vUv+off*.5,0.,1.)),e);
    col+=band*vec3(.55,.8,.75)*.10*smoothstep(0.,.1,m)*(1.-smoothstep(.9,1.,m));
  } else {                 // 顯影：柔和珍珠光由中心暈開（線性空間避免白閃）
    float t=m*1.65-.05; float f=r*.78+fbm(c*2.6+uTime*.06)*.24; float e=1.-smoothstep(t-.48,t+.08,f);
    float band=e*(1.-e)*4.;
    col=mix(A(vUv),B(vUv),e); col=mix(col,vec3(.82,.84,.81),band*.18);
  }
  gl_FragColor=vec4(max(col,0.),1.);
}`;

const gradeFrag = /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime,uTheme,uAspect; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 c=vUv-.5; vec2 cc=c*vec2(uAspect,1.)/max(uAspect,1.); float r2=dot(cc,cc);
  float ca=.0064*r2*(1.-.5*uTheme);
  vec3 col=vec3(texture2D(tDiffuse,vUv+c*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-c*ca).b);
  col*=1.-r2*mix(.75,.16,uTheme);
  col+=(h(vUv*913.+fract(uTime))-.5)*mix(.035,.016,uTheme);
  gl_FragColor=vec4(col,1.);
}`;

export function createPost(renderer, quality) {
  const mk = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality.msaa, depthBuffer: true });
  const rtA = mk(), rtB = mk();
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
  const comp = new ShaderPass(new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: compFrag, depthTest: false, depthWrite: false,
    uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uMode: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 } },
  }));
  comp.uniforms.tA.value = rtA.texture; comp.uniforms.tB.value = rtB.texture;
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), .5, .6, .85);
  const grade = new ShaderPass(new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: gradeFrag,
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTheme: { value: 0 }, uAspect: { value: 1 } },
  }));
  composer.addPass(comp); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
  return {
    resize(w, h, dpr) {
      rtA.setSize(w * dpr, h * dpr); rtB.setSize(w * dpr, h * dpr);
      composer.setPixelRatio(dpr); composer.setSize(w, h);
      comp.uniforms.uAspect.value = grade.uniforms.uAspect.value = w / h;
    },
    render(a, b, mix, mode, t, theme, bl) {
      renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(a.scene, a.camera);
      if (b) { renderer.setRenderTarget(rtB); renderer.clear(); renderer.render(b.scene, b.camera); }
      renderer.setRenderTarget(null);
      const u = comp.uniforms;
      u.uMix.value = b ? mix : 0; u.uMode.value = mode; u.uTime.value = t;
      grade.uniforms.uTime.value = t; grade.uniforms.uTheme.value = theme;
      bloom.strength = bl.strength; bloom.radius = bl.radius; bloom.threshold = bl.threshold; bloom.enabled = bl.strength > .01;
      composer.render();
    },
  };
}
