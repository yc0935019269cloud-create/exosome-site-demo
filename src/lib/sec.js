import * as THREE from 'three';

export const beadGeometryInfo = Object.freeze({
  beadRadius: .133, columnRadius: 1.45, columnHeight: 4.72,
  bedTop: 2.36, bedBottom: -2.36, pitch: .258, cutZ: .47,
});
const B = beadGeometryInfo;
const count = 96;
const TAU = Math.PI * 2;
let state = 81377;
const random = () => ((state = (Math.imul(state,1664525) + 1013904223) >>> 0) + .5) / 4294967296;

// Relax random cross-section sites against their neighbours and the bore.
// Independent axial offsets and a continuous twist decorrelate successive slices.
const sites = Array.from({length:count}, () => {
  const a = random()*TAU, r = Math.sqrt(random())*(B.columnRadius-B.beadRadius);
  return {x:r*Math.cos(a), z:r*Math.sin(a), phase:random(), key:random()*6.28};
});
for (let pass=0; pass<125; pass++) {
  for (let i=0; i<count; i++) {
    const a=sites[i];
    for (let j=i+1; j<count; j++) {
      const b=sites[j], x=a.x-b.x, z=a.z-b.z, d=Math.hypot(x,z);
      if (d>=.263) continue;
      const push=.47*(.263-d)/Math.max(d,.0001);
      a.x+=x*push; a.z+=z*push; b.x-=x*push; b.z-=z*push;
    }
    const scale=Math.min(1,(B.columnRadius-B.beadRadius*1.1)/Math.hypot(a.x,a.z));
    a.x*=scale; a.z*=scale;
  }
}
const fixed = n => n.toFixed(6);
const twist = y => .56*y+.24*Math.sin(1.8*y);
const bed=[];
const layers=Math.ceil(B.columnHeight/B.pitch);
for(const s of sites) for(let k=0;k<layers;k++) {
  const y=B.bedBottom+B.beadRadius+B.pitch*(s.phase+k+.065*Math.sin(2.64*k+s.key));
  const r=B.beadRadius*(1+.15*Math.sin(4.17*k+7.23*s.key)), a=twist(y);
  bed.push({x:s.x*Math.cos(a)-s.z*Math.sin(a)+(random()-.5)*.34,
    z:s.x*Math.sin(a)+s.z*Math.cos(a)+(random()-.5)*.34,
    y:y+(random()-.5)*.16,r,noise:random(),active:y<=B.bedTop-B.beadRadius*.8});
}
// Resolve sphere contacts in three dimensions. Starting from stratified seeds
// fills the end plates evenly, while lateral jitter breaks up helical chains.
for(let pass=0;pass<72;pass++){
  const bins=new Map(), pitch=.31;
  for(const b of bed){
    if(!b.active)continue;
    const ix=Math.floor(b.x/pitch),iy=Math.floor(b.y/pitch),iz=Math.floor(b.z/pitch);
    for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(let z=iz-1;z<=iz+1;z++){
      const others=bins.get(x+32*y+1024*z);
      if(!others)continue;
      for(const c of others){
        const dx=b.x-c.x,dy=b.y-c.y,dz=b.z-c.z;
        const d=Math.hypot(dx,dy,dz),push=.46*(b.r+c.r-d)/Math.max(.00001,d);
        if(push<=0)continue;
        b.x+=dx*push;b.y+=dy*push;b.z+=dz*push;
        c.x-=dx*push;c.y-=dy*push;c.z-=dz*push;
      }
    }
    const sc=Math.min(1,(B.columnRadius-b.r)/Math.hypot(b.x,b.z));
    b.x*=sc;b.z*=sc;b.y=THREE.MathUtils.clamp(b.y,B.bedBottom+b.r,B.bedTop-b.r);
    const key=ix+32*iy+1024*iz;
    if(!bins.has(key))bins.set(key,[]);
    bins.get(key).push(b);
  }
}
// Ten bits per coordinate keep the position error below 0.003 scene units.
const pack=b=>{
  if(!b.active)return -1;
  const quant=v=>Math.round(THREE.MathUtils.clamp(v,0,1)*1023);
  return quant(b.x/(B.columnRadius*2)+.5)+1024*quant(b.z/(B.columnRadius*2)+.5)
    +1048576*quant((b.y-B.bedBottom)/B.columnHeight);
};
const cellCount=16, span=B.columnRadius;
const near=[];
for(let z=0;z<cellCount;z++) for(let x=0;x<cellCount;x++) {
  const px=((x+.5)/cellCount*2-1)*span, pz=((z+.5)/cellCount*2-1)*span;
  const ids=sites.map((s,i)=>[Math.hypot(s.x-px,s.z-pz),i]).sort((a,b)=>a[0]-b[0]);
  near.push(ids.slice(0,4).reduce((bits,[,id],j)=>bits+id*128**j,0));
}

export const SEC_GLSL = /* glsl */`
const float secR=${fixed(B.columnRadius)}, secH=${fixed(B.columnHeight)}, secTop=${fixed(B.bedTop)};
const float secBottom=${fixed(B.bedBottom)}, secBead=${fixed(B.beadRadius)}, secPitch=${fixed(B.pitch)};
const vec4 secSites[${count}]=vec4[${count}](
${sites.map(s=>'vec4('+[s.x,s.z,s.phase,s.key].map(fixed).join(',')+')').join(',\n')});
const int secNear[256]=int[256](${near.join(',')});
const int secBed[${bed.length}]=int[${bed.length}](${bed.map(pack).join(',')});
vec2 secRotate(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
float secTwist(float y){return .56*y+.24*sin(1.8*y);}
vec3 secPath(float identity,vec3 seed,float p,float t){
  p=clamp(p,0.,1.);
  float species=step(.5,identity), a=6.2831853*seed.x;
  vec2 disc=sqrt(clamp(seed.y,0.,1.))*vec2(cos(a),sin(a))*(secR-.025);
  float gaussian=clamp(sqrt(-2.*log(max(seed.z,.00001)))*cos(6.2831853*fract(seed.x*139.231+seed.y*73.17)),-3.,3.);
  float run=max(0.,p-.245);
  float y=secTop+.35*(1.-smoothstep(0.,.25,p))-.035
          -secH*(1.99*run-species*.88*run*smoothstep(0.,.18,run));
  y+=gaussian*(.024+(.052+.042*species)*sqrt(run));
  float inside=smoothstep(secBottom-.09,secBottom+.04,y)*(1.-smoothstep(secTop-.04,secTop+.09,y));
  ivec2 cell=ivec2(clamp(floor((disc/secR*.5+.5)*16.),vec2(0.),vec2(15.)));
  int packedIds=secNear[cell.y*16+cell.x];
  vec2 base=secRotate(disc,secTwist(y)),avoid=vec2(0.);
  float deepest=0.,poreFraction=0.;
  // Query the local bead equator. The square-root expansion maps area into
  // the annulus, so particles curve around a bead without sticking to its rim.
  for(int j=0;j<4;j++){
    int id=packedIds & 127;vec4 s=secSites[id];packedIds=packedIds >> 7;
    int level=int(floor((y-secBottom-secBead)/secPitch-s.z+.5));
    for(int h=-1;h<=1;h++){
    int index=level+h;
    if(index<0 || index>=${layers})continue;
    int code=secBed[id*${layers}+index];if(code<0)continue;
    vec3 center=vec3(float(code&1023),float(code>>20),float((code>>10)&1023))/1023.;
    float cy=secBottom+secH*center.y;
    float r=secBead*(1.+.15*sin(4.17*float(index)+7.23*s.w));
    vec2 dx=base-(center.xz*2.-1.)*secR;
    float d=length(dx), section=max(r*r-(y-cy)*(y-cy),0.);
    poreFraction=max(poreFraction,1.-smoothstep(.67*r,1.12*r,length(vec2(d,y-cy))));
    float influence=1.-smoothstep(.025,.218,d);
    float push=max(sqrt(section)-d,(sqrt(d*d+section)-d)*influence);
    // Smooth the hand-off where two neighbouring pore walls influence the flow.
    float blend=smoothstep(-.008,.008,push-deepest)*step(.00001,push);
    avoid=mix(avoid,dx/max(d,.00001)*push,blend);deepest=max(deepest,push);
    }
  }
  float porePhase=58.*y+seed.z*6.283;
  vec2 mobile=base+avoid*(1.-species);
  mobile+=species*(.012+.058*poreFraction)*vec2(sin(porePhase),cos(.93*porePhase+a));
  mobile+=.003*vec2(sin(t*.65+a),cos(t*.61+a));
  mobile*=min(1.,(secR-.018)/max(.0001,length(mobile)));
  vec2 xy=mix(disc,mobile,inside);
  float taper=smoothstep(secBottom-.56,secBottom-.03,y);
  float nozzleOut=smoothstep(-3.45,-4.65,y);
  float spreadR=mix(.093,1.,taper)+nozzleOut*(.52+.72*sqrt(clamp(seed.y,0.,1.)));
  xy*=spreadR;
  float axialOut=(seed.x-.5)*1.35*nozzleOut+gaussian*.22*nozzleOut;
  return vec3(xy.x,y+species*.030*poreFraction*sin(porePhase*1.18)+axialOut,xy.y);
}`;

const surfaceVertex=`varying vec3 vPos,vNorm,vEye;
void main(){vPos=position;vec4 mv=modelViewMatrix*vec4(position,1.);
vNorm=normalMatrix*normal;vEye=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const glassFragment=`varying vec3 vPos,vNorm,vEye;
void main(){vec3 n=normalize(vNorm),v=normalize(vEye);
float edge=pow(max(0.,1.-abs(dot(n,v))),2.3);
float stripe=pow(max(0.,dot(n,vec3(-.83,.07,.55))),33.);
float facet=smoothstep(.15,.6,abs(n.y));
float side=pow(abs(n.x),4.);
vec3 tint=mix(vec3(.095,.16,.14),vec3(.71,.86,.80),.52+.48*n.x);
gl_FragColor=vec4(tint+stripe*.35,.036+edge*.66+stripe*.30+facet*(.14+.46*side));
#include <colorspace_fragment>
}`;
const hardwareFragment=`varying vec3 vPos,vNorm,vEye;
uniform float lightness, frit;
void main(){vec3 n=normalize(vNorm),v=normalize(vEye);
float soft=dot(n,vec3(-.56,.64,.52))*.5+.5;
float strip=pow(max(0.,dot(n,normalize(v+vec3(-.8,.55,.23)))),13.);
float grooves=.5+.5*cos(atan(vPos.z,vPos.x)*172.);
float grain=fract(sin(dot(floor(vPos*190.),vec3(9.13,7.33,4.68)))*3289.);
vec3 metal=mix(vec3(.041,.053,.049),vec3(.40,.47,.425),soft*soft);
metal+=strip*vec3(.58,.58,.48);
metal*=.94+.06*grooves;
gl_FragColor=vec4(mix(metal,vec3(.285,.30,.25)*(.64+.62*grain)*(.65+.45*soft),frit),1.);
#include <colorspace_fragment>
}`;

export function createSec({quality={}}={}) {
  const low=quality.tier==='low',group=new THREE.Group();
  const lightness={value:0};
  const shader=(frag,props={})=>new THREE.ShaderMaterial({
    vertexShader:surfaceVertex,fragmentShader:frag,uniforms:{lightness,frit:{value:0}},...props});
  const glass=shader(glassFragment,{transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  const metal=shader(hardwareFragment),frit=shader(hardwareFragment);
  frit.uniforms.frit.value=1;
  function turned(profile,mat,start=0,arc=TAU) {
    const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),80,start,arc);
    const mesh=new THREE.Mesh(g,mat);
    mesh.renderOrder=mat===glass?4:0;group.add(mesh);
  }
  // The omitted front sector exposes both glass lips and the gel section.
  turned([[1.486,-2.4],[1.486,2.47],[1.452,2.47],[1.452,-2.4]],glass,.97,TAU-1.94);
  turned([[0,-2.425],[1.43,-2.425],[1.455,-2.41],[1.455,-2.36],[1.43,-2.35],[0,-2.35]],frit);
  turned([[.072,-3.58],[.10,-3.58],[.13,-3.22],[.145,-3.02],[.28,-2.99],[.36,-2.92],[1.43,-2.53],[1.48,-2.48],[1.48,-2.43]],glass);
  turned([[.12,-3.22],[.20,-3.22],[.23,-3.18],[.23,-3.05],[.19,-3.02]],metal);
  turned([[1.39,2.43],[1.50,2.46],[1.50,2.69],[1.45,2.72],[1.41,2.71]],glass);
  turned([[.24,3.08],[.24,2.79],[1.45,2.7],[1.52,2.73],[1.52,2.82],[1.46,2.84],[.42,2.89],[.34,2.96],[.34,3.06],[.29,3.08],[.24,3.08]],metal);
  turned([[1.45,-2.54],[1.5,-2.52],[1.5,-2.46],[1.45,-2.44]],metal);
  turned([[.15,3.05],[.15,3.49],[.12,3.49],[.12,3.05]],glass);
  turned([[.25,3.14],[.31,3.16],[.31,3.21],[.26,3.23]],metal);

  const records=bed.filter(b=>b.active);
  // Back-to-front order makes translucency stable with the cut face toward +Z.
  records.sort((a,b)=>a.z-b.z);
  const geo=new THREE.PlaneGeometry(2,2);
  const gel=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{lightness},
    vertexShader:`varying vec2 uvBall;varying float zBed,salt,rad;varying vec3 cutAxis;
    attribute float fleck;
    void main(){vec3 center=instanceMatrix[3].xyz;rad=instanceMatrix[0].x;
      zBed=center.z;salt=fleck;uvBall=position.xy;
      cutAxis=normalize(modelViewMatrix[2].xyz);
      vec4 mv=modelViewMatrix*vec4(center,1.);
      mv.xy+=position.xy*rad*length(modelViewMatrix[0].xyz);
      gl_Position=projectionMatrix*mv;
      if(center.z-rad>${fixed(B.cutZ)})gl_Position=vec4(2.,2.,2.,1.);}`,
    fragmentShader:`uniform float lightness;varying vec2 uvBall;varying float zBed,salt,rad;varying vec3 cutAxis;
    void main(){float d=dot(uvBall,uvBall);if(d>=1.)discard;
      float nz=sqrt(1.-d),cut=((${fixed(B.cutZ)}-zBed)/rad-dot(cutAxis.xy,uvBall))/max(.01,cutAxis.z);
      if(cut < -nz)discard;
      float skin=1.-smoothstep(cut-.06,cut+.06,nz);
      float thickness=clamp((nz+min(cut,nz))*.5,0.,1.);
      vec3 n=vec3(uvBall,nz);
      vec2 pore=(uvBall+.12*sin(uvBall.yx*4.+salt*34.))*4.2+salt*71.;vec2 id=floor(pore);
      vec2 noise=fract(sin(vec2(dot(id,vec2(17.27,4.19)),dot(id,vec2(5.17,13.3))))*2361.);
      float pit=1.-smoothstep(.06,.31,length(fract(pore)-.23-.54*noise));
      float key=dot(n,vec3(-.55,.65,.52))*.5+.5;
      float rim=pow(max(0.,1.-nz),2.5);
      vec3 col=mix(vec3(.045,.076,.065),vec3(.280,.346,.279),key*key);
      col+=vec3(.037,.052,.044)*(1.-skin)*thickness;
      col*=.73+.27*salt;col*=.54+.46*smoothstep(-1.2,.45,zBed);
      float back=pow(max(0.,dot(n,vec3(.42,-.71,.55))),6.);
      col+=vec3(.09,.14,.11)*rim+vec3(.12,.14,.115)*back*thickness;
      col+=vec3(.12,.14,.12)*skin*pow(max(0.,dot(n,vec3(-.38,.53,.756))),17.);
      col*=1.-.26*pit;col*=.80-.19*lightness;
      float opacity=min(.94,${low?'1.40':'1.'}*(.12+.57*thickness+.16*skin*rim))*(1.-smoothstep(.93,1.,d));
      gl_FragColor=vec4(col,opacity);
      #include <colorspace_fragment>
    }`
  });
  const n=low?Math.floor(records.length/4):records.length;
  let visible=records;
  if(low){
    // Keep the near strata at every lateral position, including the narrow
    // margins. These dominate the optical depth of the high-tier cutaway.
    const depth=b=>Math.min(B.cutZ,Math.sqrt(Math.max(0,B.columnRadius**2-b.x*b.x)))-b.z;
    visible=records.filter(b=>b.z<B.cutZ).sort((a,b)=>depth(a)-depth(b))
      .slice(0,n).sort((a,b)=>a.z-b.z);
  }
  const mesh=new THREE.InstancedMesh(geo,gel,n),m=new THREE.Matrix4(),flecks=new Float32Array(n);
  for(let i=0;i<n;i++){
    const b=visible[i];
    m.makeScale(b.r,b.r,b.r).setPosition(b.x,b.y,b.z);
    mesh.setMatrixAt(i,m);flecks[i]=b.noise;
  }
  geo.setAttribute('fleck',new THREE.InstancedBufferAttribute(flecks,1));
  mesh.renderOrder=1;group.add(mesh);
  return {group,update(p,t,theme,camera){lightness.value=THREE.MathUtils.clamp(theme,0,1);},
    dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();});
      for(const mat of [metal,frit,glass,gel])mat.dispose();group.removeFromParent();}};
}
