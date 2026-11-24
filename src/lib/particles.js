import * as THREE from 'three';
import { SEC_GLSL, beadGeometryInfo } from './sec.js';

const TAU = Math.PI * 2;
export const fiber = { start: -4.1, length: 8.4, radius: 1.12, thickness: .16, cols: 34, rows: 20 };
// The sec.js column is vertical; it is laid on its side (top toward -x) so the
// flow keeps running left to right from TFF into the NTA field.
export const secPlace = { x: 10, scale: 1.3, start: .47, span: .19 };
export const plot = { center: 19, width: 8.4, base: -.85, height: 3.25, depth: 1.1, bins: 34 };
const fx = n => n.toFixed(4);

// CPU mirror of the mean band position inside secPath (species 0 = EV, 1 = protein).
export function secBandX(p, species) {
  const sp = THREE.MathUtils.clamp((p - secPlace.start) / secPlace.span, 0, 1);
  const B = beadGeometryInfo, run = Math.max(0, sp - .245);
  const y = B.bedTop + .35 * (1 - THREE.MathUtils.smoothstep(sp, 0, .25)) - .035
    - B.columnHeight * (1.99 * run - species * .88 * run * THREE.MathUtils.smoothstep(run, 0, .18));
  return secPlace.x - secPlace.scale * y;
}

// The same staggered lattice defines both the membrane bores and the filtrate paths.
export function pore(col, row) {
  return [
    fiber.start + (col + .5 + .17 * Math.sin(row * 8.31 + col * 2.13)) * fiber.length / fiber.cols,
    (row + .5 + .18 * Math.sin(col * 5.37 + row * 3.43)) * TAU / fiber.rows,
  ];
}

function randomStream() {
  let seed = 0x9eba3371;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed + .5) / 4294967296;
  };
}

const vertex = /* glsl */`
attribute vec4 seeds;
attribute vec4 process;
attribute vec4 histogram;
uniform float uP, uTime, uPixels, uLight, uMotion, uPlotWidth, uFieldWidth, uHover, uHoverOn, uFocus;
varying vec3 vColor;
varying float vAlpha, vBlur, vGrain, vDebris, vPearl;
const float tau=6.2831853;
${SEC_GLSL}
vec2 radial(float theta){return vec2(cos(theta),sin(theta));}
void main(){
  float p=uP, t=uTime*uMotion, a=seeds.x, b=seeds.y, c=seeds.z, d=seeds.w;
  float kind=process.x;
  bool ev=kind<.5, residue=kind<1.5 && !ev, debris=kind>2.5;
  vec3 q=vec3(0.);
  float alpha=1.;
  float diameter=histogram.x;
  float size=ev ? .030*(.52+diameter/115.) : (debris ? .095+.15*c*c : .009+.015*c*c);
  float field=0., hover=0., pearl=0.;
  if(p<.51){
    float stream=floor(d*7.);
    vec3 feed=vec3(-18.8+10.*a+7.5*smoothstep(-.035,.13,p),(.5-b)*mix(1.6,6.2,c),(c-.5)*6.8);
    feed.y+=.72*sin(feed.x*.91+stream*.84+p*18.+t*.24)+.40*cos(stream*2.+feed.x*.52);
    feed.z+=.24*sin(feed.x*.64+b*5.+p*13.);
    if(debris) feed.x=min(feed.x,-5.56-.44*d);
    float clear=smoothstep(.084+.045*d,.203+.024*d,p);
    if(debris){
      vec2 yz=radial(b*tau)*sqrt(c)*1.99;
      q=mix(feed,vec3(-5.56-.44*d,yz),clear);
      alpha=1.-smoothstep(.224,.27,p);
    }else{
      vec3 intake=vec3(-6.8+3.7*a+1.45*smoothstep(.14,.245,p),radial(b*tau)*sqrt(c)*.99);
      q=mix(feed,intake,clear);
      // Forward lumen and a parallel return limb meet in smooth bends outside the cutaway.
      float bend=1.325,straight=8.4,arc=3.14159265*bend,len=2.*(straight+arc);
      float lap=fract(a+(min(p,.438)-.24)*2.3+.026*sin(t*.61+3.*a));
      float collect=smoothstep(.437+.003*d,.479+.003*d,p);
      float pathLen=fract(lap+mod(straight/len-lap+1.,1.)*collect)*len;
      float x=-4.1+pathLen,back=0.;
      if(pathLen>straight+arc+straight){
        float turn=(pathLen-2.*straight-arc)/bend;
        x=-4.1-bend*sin(turn);back=-bend*(1.+cos(turn));
      }else if(pathLen>straight+arc){
        x=4.3-(pathLen-straight-arc);back=-2.*bend;
      }else if(pathLen>straight){
        float turn=(pathLen-straight)/bend;
        x=4.3+bend*sin(turn);back=-bend*(1.-cos(turn));
      }
      float path=floor(b*7.)*tau/7.+.26*sin(x*.85+c*2.)+.28*(d-.5);
      vec2 yz=radial(path)*(.31+.56*c);
      vec3 lumen=vec3(x,yz+vec2(0.,back));
      if(!ev && !residue){
        float phase=clamp((p-.245)/.22*1.32+.25*a-.58*d,0.,1.);
        float crossing=smoothstep(.20,.73,phase);
        float theta=process.z;
        float radius=mix(.22+.70*c,1.12,crossing)+3.8*smoothstep(.69,1.,phase);
        x=process.y-2.9*(1.-crossing)+.72*smoothstep(.82,1.,phase);
        yz=radial(theta+(1.-crossing)*.45*(b-.5))*radius;
        yz+=radial(b*tau)*.21*smoothstep(.76,1.,phase);
        lumen=vec3(x,yz);
        alpha=(1.-smoothstep(.87,1.,phase))*(1.+2.7*smoothstep(.50,.81,phase));
      }
      q=mix(q,lumen,smoothstep(.20+.018*d,.292+.01*d,p));
    }
  }
  if(p>=.435 && p<.72 && kind<1.5){
    // Same particles, sec.js column path. Local column frame -> world (top at -x).
    float sp=clamp((p-${fx(secPlace.start)})/${fx(secPlace.span)},0.,1.);
    vec3 local=secPath(ev ? 0. : 1.,vec3(b,c,d),sp,t);
    vec3 sec=vec3(${fx(secPlace.x)}-${fx(secPlace.scale)}*local.y,${fx(secPlace.scale)}*local.x,${fx(secPlace.scale)}*local.z);
    if(!ev) size=mix(size,.026+.014*c,smoothstep(.475,.525,p));
    else size*=.78;
    if(p<.51) q=mix(q,sec,smoothstep(.468+.004*d,.500+.006*d,p)); else q=sec;
    if(!ev) alpha=1.-smoothstep(.666,.704,p);
  }
  if(ev && p>.626){
    float ang=tau*b;
    vec3 samplePos=vec3(19.+uFieldWidth*2.25*sqrt(a)*cos(ang),1.53*sqrt(a)*sin(ang),1.55*(c-.5));
    float freq=94./max(diameter,30.);
    vec3 phase=t*freq*vec3(.78,1.12,.92)+tau*vec3(b,c,d);
    samplePos+=.070*sqrt(freq)*(sin(phase*2.73)+.54*sin(phase*5.91+tau*d)+.28*sin(phase*10.27+tau*a));
    float lift=smoothstep(.640+.014*d,.702+.010*b,p);
    q=mix(q,samplePos,lift);
    q.y+=sin(lift*3.14159)*(.45+c*.64);
    field=lift*(1.-smoothstep(.742,.828,p));
    float delay=.023*(histogram.y+.5)+.018*histogram.z+.009*d;
    float assemble=smoothstep(.727+delay,.780+delay,p);
    float gx=histogram.y*uPlotWidth;
    hover=(1.-smoothstep(.032,.095,abs(histogram.y-uHover)))*uHoverOn*assemble;
    vec3 chart=vec3(${fx(plot.center)}+gx,${fx(plot.base)}+histogram.z*${fx(plot.height)}+.28*hover,histogram.w);
    q=mix(q,chart,assemble);
    q.y+=sin(3.14159*assemble)*(.28+.55*b);
    size*=mix(1.,.92+.22*c,assemble);
    pearl=assemble;
    float mist=smoothstep(.934+.022*d,1.005,p);
    q+=vec3((a-.5)*4.7,1.8+2.5*b,(c-.5)*5.0)*mist;
    size*=1.+2.2*mist;
    alpha*=1.-smoothstep(.95,1.,p);
  }
  vec4 mv=modelViewMatrix*vec4(q,1.);
  gl_Position=projectionMatrix*mv;
  float dist=max(.4,-mv.z);
  float feedDOF=1.-smoothstep(.15,.265,p);
  vBlur=clamp(abs(dist-uFocus)/max(uFocus,.1)*(1.7+feedDOF*.9)+.64*field*abs(2.*c-1.),0.,1.);
  float px=size*uPixels/dist;
  gl_PointSize=clamp(px*(1.+vBlur*1.65),1.,72.);
  float trans=ev ? .26+.66*smoothstep(.85,1.,d) : (debris ? .85 : .12+.58*smoothstep(.91,1.,c));
  trans=mix(trans,1.,smoothstep(.443,.505,p));
  float focalSlice=exp(-63.*abs(c-.51));
  trans*=mix(1.,.005+.995*focalSlice,field);
  vAlpha=alpha*min(px,1.)*trans/(1.+vBlur*2.85);
  if(alpha<.005){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;}
  vec3 jade=mix(vec3(.43,.72,.62),vec3(.83,1.04,.91),d);
  vec3 amber=mix(vec3(.13,.057,.022),vec3(.60,.27,.096),b*b);
  if(residue) amber*=mix(vec3(1.),vec3(2.5,1.85,1.0),smoothstep(.475,.525,p));
  vColor=ev ? mix(jade,jade*vec3(.37,.51,.48),uLight*(1.-field)) : (debris ? vec3(.24,.19,.255) : amber);
  vColor*=1.+1.2*field+hover*.95;
  vColor*=mix(.63,1.,c)*mix(1.,exp(-.15*max(dist-uFocus+.8,0.)),1.-uLight);
  // Pearl white with a faint jade cast once the particles settle into the chart.
  vec3 pearlBase=mix(vec3(.93,.94,.90),vec3(.88,.95,.92),.35+.4*d)*(1.+.22*hover);
  vColor=mix(vColor,pearlBase,pearl);
  vColor=mix(vColor,vec3(.93,1.02,.98),smoothstep(.94,1.,p));
  vGrain=d;
  vDebris=debris ? 1. : 0.;
  vPearl=pearl;
}`;

const fragment = /* glsl */`
uniform float uP;
varying vec3 vColor;
varying float vAlpha,vBlur,vGrain,vDebris,vPearl;
void main(){
  vec2 xy=gl_PointCoord*2.-1.;
  xy.y=-xy.y;
  xy.x*=1.+vDebris*(.29+.10*sin(xy.y*7.+vGrain*9.));
  xy.y+=vDebris*.14*sin(2.8*xy.x+vGrain*6.28);
  float r=dot(xy,xy);
  if(r>1.) discard;
  float nz=sqrt(max(1.-r,0.));
  vec3 n=vec3(xy,nz);
  float key=max(dot(n,vec3(-.49,.58,.65)),0.);
  float gloss=pow(max(dot(n,vec3(-.33,.45,.828)),0.),19.);
  float rim=pow(1.-nz,2.);
  vec3 col=vColor*(.23+.87*key+.11*nz)+gloss*(.21+.42*vGrain)+rim*vColor*.32;
  if(vPearl>.001){
    // Nacre: soft key, iridescent fresnel rim, contact shadow on the underside.
    float diff=max(dot(n,normalize(vec3(-.42,.62,.66))),0.);
    float spec=pow(max(dot(n,normalize(vec3(-.25,.42,.87))),0.),26.);
    float fres=pow(1.-nz,1.8);
    vec3 irid=.5+.5*cos(6.2831853*(fres*1.15+vGrain*.35+vec3(0.,.33,.67)));
    vec3 nacre=vColor*(.50+.46*diff+.16*nz)+fres*irid*.30+spec*.55;
    nacre*=1.-.30*(1.-smoothstep(-1.,-.15,xy.y))*(1.-.5*diff);
    col=mix(col,nacre,vPearl);
  }
  col=mix(col,vec3(.90,.96,.92),.90*smoothstep(.94,1.,uP));
  float edge=mix(1.-smoothstep(.72,1.,r),exp(-4.6*r)*(1.-smoothstep(.65,1.,r)),vBlur);
  edge=mix(edge,mix(1.-smoothstep(.86,1.,r),exp(-3.2*r)*(1.-smoothstep(.7,1.,r)),vBlur),vPearl);
  gl_FragColor=vec4(col,edge*vAlpha);
}`;

export function createParticles(low, reduced) {
  const count=low ? 32000 : 144000;
  const evCount=Math.round(count*.08), retainedEnd=evCount+Math.round(count*.045);
  const debrisStart=count-Math.round(count*.0028);
  const seeds=new Float32Array(count*4), process=new Float32Array(count*4);
  const histogram=new Float32Array(count*4), bins=new Uint16Array(plot.bins);
  const rand=randomStream();
  // Stratified draws preserve the tail in the smaller mobile sample.
  const mass=[],sigma=.284;
  const pdf=nm=>Math.exp(-.5*(Math.log(nm/108)/sigma)**2)/nm;
  let integral=0,pdfMax=0;
  for(let nm=30.05;nm<200;nm+=.10){
    integral+=pdf(nm);pdfMax=Math.max(pdfMax,pdf(nm));
    mass.push(integral);
  }
  let quantile=0;
  for(let i=0;i<count;i++){
    const j=i*4;
    for(let k=0;k<4;k++) seeds[j+k]=rand();
    const row=rand()<.68 ? [0,1,8,9,10,19][Math.floor(rand()*6)] : Math.floor(rand()*fiber.rows);
    const [x,theta]=pore(Math.floor(rand()*fiber.cols),row);
    process[j]=i<evCount ? 0 : i<retainedEnd ? 1 : i<debrisStart ? 2 : 3;
    process[j+1]=x; process[j+2]=theta;
    if(i>=evCount) continue;
    const target=(i+rand())/evCount*integral;
    while(quantile<mass.length-1 && mass[quantile]<target)quantile++;
    const nm=30.05+.1*quantile;
    const bin=Math.floor((nm-30)/5);
    histogram[j]=nm; histogram[j+1]=(nm-30)/170-.5;
    // Low-discrepancy fill under the continuous curve: dense, level stacking with a smooth top.
    const u=((bins[bin]++ +.5)*.6180339887+bin*.1372)%1;
    histogram[j+2]=(.004+.996*u)*pdf(nm)/pdfMax;
  }
  for(let i=0;i<evCount;i++){
    const j=i*4;
    histogram[j+1]+=(seeds[j]-.5)*.0016;
    histogram[j+3]=(seeds[j+2]-.5)*plot.depth;
  }
  // EVs never mix with other kinds in draw order; drawing them back to front
  // lets nearer pearls overlap farther ones in the chart.
  const order=Array.from({length:evCount},(_,i)=>i).sort((x,y)=>histogram[x*4+3]-histogram[y*4+3]);
  for(const arr of [seeds,process,histogram]){
    const copy=arr.slice(0,evCount*4);
    order.forEach((src,dst)=>{for(let k=0;k<4;k++)arr[dst*4+k]=copy[src*4+k];});
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
  for(const [key,data] of Object.entries({seeds,process,histogram})) g.setAttribute(key,new THREE.BufferAttribute(data,4));
  const uniforms={};
  for(const key of ['uP','uTime','uPixels','uLight','uPlotWidth','uFieldWidth','uHover','uHoverOn','uFocus']) uniforms[key]={value:0};
  uniforms.uMotion={value:reduced ? .16 : 1};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.NormalBlending});
  const points=new THREE.Points(g,material);
  points.frustumCulled=false; points.renderOrder=2;
  return {points,uniforms,update(p){
    uniforms.uP.value=p;
    g.setDrawRange(0,p>=.708 ? evCount : p>=.51 ? retainedEnd : p>=.27 ? debrisStart : count);
  }};
}
