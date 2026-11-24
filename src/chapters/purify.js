import * as THREE from 'three';
import { createParticles, fiber, plot, pore, secPlace, secBandX } from '../lib/particles.js';
import { createSec } from '../lib/sec.js';

const tau=Math.PI*2;
const smooth=(a,b,p)=>THREE.MathUtils.smoothstep(p,a,b);
const mix=THREE.MathUtils.lerp;
const vec=(x,y,z)=>new THREE.Vector3(x,y,z);

function surface(vertexShader,fragmentShader,extra={}) {
  return new THREE.ShaderMaterial({uniforms:{opacity:{value:1},...extra},vertexShader,fragmentShader,
    transparent:true,side:THREE.DoubleSide,forceSinglePass:true});
}

// A pierced wall has an inner skin, an outer skin and a connecting bore at every opening.
// The rectangular tiling shares its perimeter vertices geometrically, even at the cut face.
function porousWall(flat=false){
  const positions=[],normals=[],colors=[],indices=[];
  function vertex(x,s,r,tone,facing,nx,ns){
    if(flat) positions.push(-5.54+r,x*Math.sqrt(Math.max(.1,1.-.5*(s/2.31)**2)),s*Math.sqrt(Math.max(.1,1.-.5*(x/2.31)**2)));
    else positions.push(x,r*Math.cos(s),r*Math.sin(s));
    if(flat) normals.push(facing,nx,ns);
    else normals.push(nx,facing*Math.cos(s)-ns*Math.sin(s),facing*Math.sin(s)+ns*Math.cos(s));
    colors.push(tone);return colors.length-1;
  }
  const cols=flat ? 21 : fiber.cols, rows=flat ? 21 : fiber.rows;
  const dx=flat ? .22 : fiber.length/cols, ds=flat ? .22 : tau/rows;
  const edge=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
  function join(a,b){for(let k=0;k<8;k++){const n=(k+1)%8;indices.push(a+k,a+n,b+k,a+n,b+n,b+k);}}
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
    // Remove the camera-facing sector to expose the lumen and the thickness at both lips.
    if(!flat && row>=2 && row<8) continue;
    const x=(flat ? -cols*dx/2 : fiber.start)+(col+.5)*dx;
    const s=(flat ? -rows*ds/2 : 0)+(row+.5)*ds;
    const [px,ps]=flat ? [x+.034*Math.sin(row*5+col),s+.031*Math.cos(row+col*8)] : pore(col,row);
    const jitter=.5+.5*Math.sin(row*113.6+col*37.2);
    const outer=flat ? .24 : fiber.radius+fiber.thickness, inner=flat ? 0 : fiber.radius;
    const rings=[];
    for(let n=0;n<4;n++){
      rings.push(colors.length);
      for(const [cx,cs] of edge){
        const angle=Math.atan2(cs,cx), hole=n===1||n===2;
        vertex(hole ? px+Math.cos(angle)*dx*(.21+.075*jitter) : x+cx*dx*.5,
          hole ? ps+Math.sin(angle)*ds*(.20+.055*jitter) : s+cs*ds*.5,
          n<2 ? outer : inner,(n===2 ? .47 : n===1 ? .76 : 1.)*(.94+.06*jitter),
          n<2 ? 1 : -1,hole ? -.85*Math.cos(angle) : 0,hole ? -.85*Math.sin(angle) : 0);
      }
    }
    join(rings[0],rings[1]);join(rings[1],rings[2]);join(rings[2],rings[3]);
    for(let k=0;k<8;k++){
      const end=col===0 && (k===6 || k===7) || col===cols-1 && (k===2 || k===3);
      const lip=!flat && ((row===1 && (k===4||k===5)) || (row===8 && k<2));
      if(end||lip){const n=(k+1)%8,A=rings[0],B=rings[3];indices.push(A+k,A+n,B+k,A+n,B+n,B+k);}
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('shade',new THREE.Float32BufferAttribute(colors,1));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setIndex(indices);return g;
}

const membraneVertex=`
attribute float shade;
varying vec3 pos,nrm,viewDir;
varying float cavity;
void main(){pos=position;vec4 mv=modelViewMatrix*vec4(position,1.);
  nrm=normalMatrix*normal;viewDir=-mv.xyz;cavity=shade;gl_Position=projectionMatrix*mv;}`;
const membraneFragment=`
uniform float opacity,secondary;
varying vec3 pos,nrm,viewDir;
varying float cavity;
void main(){
  vec3 n=normalize(nrm+vec3(.00001)),v=normalize(viewDir);
  if(dot(n,v)<0.) n=-n;
  float grain=sin(pos.x*164.+pos.y*72.+sin(pos.z*85.))*sin(pos.y*139.-pos.z*104.);
  n=normalize(n+.085*vec3(grain,-grain*.7,grain*.38));
  float light=max(dot(n,vec3(-.43,.76,.49)),0.);
  float edge=pow(max(1.-dot(n,v),0.),2.3);
  float satin=pow(max(0.,dot(n,normalize(vec3(-.47,.74,.49)+v))),15.);
  vec3 col=mix(vec3(.021,.042,.040),vec3(.24,.31,.259),light*.73+cavity*.11);
  col=(col+edge*vec3(.08,.14,.12)+satin*vec3(.19,.22,.18))*cavity;
  col*=mix(1.,.26,secondary);
  col=mix(vec3(.022,.025,.021),col,exp(-.045*max(length(viewDir)-2.5,0.)));
  gl_FragColor=vec4(col,opacity);
}`;

function membrane(flat,secondary=0,geometry){
  const material=surface(membraneVertex,membraneFragment,{secondary:{value:secondary}});
  return new THREE.Mesh(geometry||porousWall(flat),material);
}

function makeAxis(){
  const group=new THREE.Group();
  const lines=[-.5,0,0,.5,0,0];
  const labels=[];
  for(const nm of [50,100,150,200]){
    const x=(nm-30)/170-.5;
    lines.push(x,0,0,x,-.09,0);
    const canvas=document.createElement('canvas');
    canvas.width=192;canvas.height=64;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#203f3b';ctx.font='500 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(nm===200 ? '200 nm' : String(nm),96,32);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    label.renderOrder=5;group.add(label);labels.push([label,x]);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const axis=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x42655c,transparent:true,depthWrite:false}));
  group.add(axis);group.position.set(plot.center,plot.base-.06,plot.depth*.5+.06);
  return {group,update(width,alpha){
    group.visible=alpha>.002;
    if(!group.visible)return;
    axis.scale.x=width;axis.material.opacity=alpha*.85;
    for(const [sprite,x] of labels){sprite.position.set(x*width,-.21,0);sprite.scale.set(.94,.313,1);sprite.material.opacity=alpha;}
  }};
}

function darkField(){
  const mat=surface(`varying vec2 xy;void main(){xy=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    `uniform float opacity;varying vec2 xy;void main(){float r=length(xy);
      // Microscope field: a dark core that thins into the bright room with no rim.
      float a=1.-smoothstep(.22,1.,r);a=a*a*(3.-2.*a);
      vec3 col=mix(vec3(.010,.018,.024),vec3(.032,.046,.052),1.-r);
      gl_FragColor=vec4(col,a*opacity);}`);
  mat.depthWrite=false;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(10.4,7.2),mat);
  m.position.set(19,0,-.92);m.renderOrder=-1;return m;
}

// Distant, defocused hollow-fibre bundles and filtrate haze behind the TFF shot.
// Attached to the camera so they always sit in the far right of the frame.
function farBundles(){
  const group=new THREE.Group(),mats=[];
  const vs=`varying vec2 xy;void main(){xy=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const fs=`uniform float opacity,kind,seed;varying vec2 xy;
    void main(){
      float ends=smoothstep(1.,.55,abs(xy.x));
      float tube=.30*(1.-xy.y*xy.y)+exp(-pow((abs(xy.y)-.78)/.16,2.));
      float banding=.82+.18*sin(xy.x*9.+seed*7.);
      float mist=exp(-2.6*dot(xy,xy))*(.75+.25*sin(xy.x*3.1+xy.y*2.3+seed*5.));
      float a=mix(tube*ends*banding*.42,mist*.30,kind);
      vec3 col=mix(vec3(.16,.23,.21),vec3(.13,.20,.18),kind);
      gl_FragColor=vec4(col,a*opacity);}`;
  const add=(kind,x,y,z,sx,sy,rot,seed)=>{
    const mat=surface(vs,fs,{kind:{value:kind},seed:{value:seed}});
    mat.depthWrite=false;mat.depthTest=false;mats.push(mat);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
    m.position.set(x,y,z);m.scale.set(sx,sy,1);m.rotation.z=rot;m.renderOrder=-6;m.frustumCulled=false;group.add(m);
  };
  add(1,6.2,.4,-13,13,8,0,.3);add(1,4.0,-2.4,-11,9,5,.2,.8);
  add(0,5.6,1.7,-16,17,1.35,-.17,.1);add(0,7.6,-.9,-18,19,1.7,-.12,.5);
  add(0,3.9,3.7,-20,15,1.15,-.22,.9);add(0,8.4,-3.6,-15,13,1.45,-.25,.4);
  add(0,10.2,2.4,-22,16,1.9,-.15,.7);
  return {group,update(alpha,aspect,p){
    group.visible=alpha>.003;
    group.scale.x=Math.min(1,aspect/1.78);group.position.x=-(p-.33)*4.;
    for(const m of mats)m.uniforms.opacity.value=alpha;
  }};
}

function backdrop(){
  const mat=surface(`varying vec2 xy;void main(){xy=position.xy;gl_Position=vec4(xy,.999999,1.);}`,
    `uniform float light,cool,aspect;uniform vec2 glow;varying vec2 xy;
      void main(){
        float halo=exp(-2.1*dot(xy-vec2(.15,.24),xy-vec2(.15,.24)));
        vec3 dark=vec3(.0058,.0048,.0051)+halo*vec3(.021,.016,.010);
        // Warm white light opens from the column outlet; only a thin front is mid-tone.
        float r=length((xy-glow)*vec2(aspect,1.));
        float reach=light*(5.2+aspect);
        float lit=1.-smoothstep(reach-1.1,reach,r);
        vec3 warm=mix(vec3(1.,.965,.90),vec3(.93,.90,.85),smoothstep(0.,3.,r));
        // Cool pearl-mist gradient for the chart so pearl-white particles read against it.
        vec3 grey=mix(vec3(.35,.39,.425),vec3(.60,.64,.675),smoothstep(-1.,1.,xy.y));
        grey+=.07*exp(-1.4*dot(xy-vec2(.1,.35),xy-vec2(.1,.35)));
        gl_FragColor=vec4(mix(dark,mix(warm,grey,cool),lit),1.);
      }`,{light:{value:0},cool:{value:0},aspect:{value:1},glow:{value:new THREE.Vector2(.6,0)}});
  mat.depthWrite=false;mat.depthTest=false;mat.transparent=false;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);
  m.frustumCulled=false;m.renderOrder=-10;return m;
}

// sec.js materials have no opacity; prepend a shared fade uniform to each one.
function fadeable(group){
  const fade={value:0},seen=new Set();
  group.traverse(o=>{
    const mat=o.material;if(!mat || seen.has(mat))return;seen.add(mat);
    mat.uniforms.uFade=fade;mat.transparent=true;
    mat.fragmentShader='uniform float uFade;\n'+mat.fragmentShader.replace('#include <colorspace_fragment>','gl_FragColor.a*=uFade;\n#include <colorspace_fragment>');
    mat.needsUpdate=true;
  });
  return fade;
}

// Position and gaze travel separately, so the camera can pass a near wall while
// keeping focus on the material further down the lumen.
const stops=[
  [0,-10.6,.58,5.4,-8.6,.12,0],[.10,-9.3,.58,5.4,-7.35,.10,0],
  [.18,-9.2,.88,5.1,-5.35,.14,0],[.24,-7.7,.76,4.3,-3.6,.10,0],
  [.286,-6.0,.44,2.57,-1.85,.12,0],[.326,-4.05,.28,.93,.37,.05,-.07],
  [.365,-3.75,.61,3.27,.48,.14,0],[.42,-2.65,1.01,5.25,.70,.14,0],
  [.47,-.36,1.15,5.78,2.8,.15,0],[.525,8.0,.75,10.9,9.2,-.55,0],
  [.60,9.3,.65,10.7,9.85,-.62,0],[.655,11.9,.45,10.1,12.5,-.5,0],
  [.71,18.52,.80,7.6,18.85,.25,0],[.78,18.80,1.30,7.75,18.95,.30,0],
  [.90,18.72,1.45,7.85,18.90,.32,0],[1,18.85,1.75,8.1,18.95,.70,0],
];
function cameraPose(p,pos,aim){
  let i=0;while(i<stops.length-2 && stops[i+1][0]<p)i++;
  const a=stops[i],b=stops[i+1],prev=stops[Math.max(0,i-1)],next=stops[Math.min(stops.length-1,i+2)];
  const dt=b[0]-a[0],s=THREE.MathUtils.clamp((p-a[0])/dt,0,1);
  for(let k=1;k<=6;k++){
    const da=dt*(b[k]-prev[k])/(b[0]-prev[0]),db=dt*(next[k]-a[k])/(next[0]-a[0]);
    const v=mix(a[k],b[k],s*s*(3.-2.*s))+s*(1.-s)*((1.-s)*da-s*db);
    (k<=3 ? pos : aim).setComponent((k-1)%3,v);
  }
}

export async function createChapter({quality,reduced}){
  const low=quality.tier==='low',scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.08,75);
  const dark=new THREE.Color('#191411'),clean=new THREE.Color('#eef0ec');
  scene.background=dark.clone();scene.fog=new THREE.FogExp2(scene.background,.045);
  const dust=createParticles(low,reduced),bg=backdrop();scene.add(dust.points,bg);
  const filter=membrane(true,.35),wall=membrane(false);
  const rimMaterial=new THREE.MeshBasicMaterial({color:0x727769,transparent:true,depthWrite:false});
  const rim=new THREE.Mesh(new THREE.TorusGeometry(2.31,.044,8,96),rimMaterial);
  rim.rotation.y=Math.PI/2;rim.position.x=-5.55;filter.add(rim);
  scene.add(filter,wall);
  const neighbours=[];
  for(const [y,z] of [[0,-2.65],[2.49,-1.74],[-2.49,-1.74]]){
    const m=membrane(false,1,wall.geometry);
    m.position.set(.12,y,z);m.rotation.x=-.35;scene.add(m);neighbours.push(m);
  }
  const column=createSec({quality}),secFade=fadeable(column.group);
  column.group.rotation.z=Math.PI/2;column.group.position.set(secPlace.x,0,0);
  column.group.scale.setScalar(secPlace.scale);
  const far=farBundles();scene.add(camera);camera.add(far.group);
  const axis=makeAxis(),field=darkField(),outlet=vec(0,0,0);
  scene.add(column.group,axis.group,field);
  const label=(id,start,end,side)=>({id,pos:vec(0,0,0),p:[start,end],side});
  const labels=[label('fiber',.244,.473,'left'),label('retentate',.255,.475,'right'),
    label('permeate',.26,.47,'right'),label('bead',.478,.659,'left'),
    label('evpeak',.50,.665,'right'),label('protpeak',.509,.664,'left')];
  const aim=vec(0,0,0),direction=vec(0,0,0),mouse=vec(0,0,0);
  let w=1,h=1,pixelRatio=1,hasPointer=false;
  window.addEventListener('pointermove',()=>{hasPointer=true;},{passive:true});
  document.addEventListener('pointerleave',()=>{hasPointer=false;},{passive:true});
  function show(obj,alpha){obj.visible=alpha>.003;obj.material.uniforms.opacity.value=alpha;}
  const theme=p=>smooth(.635,.705,p);
  return {scene,camera,labels,theme,bloom(p){return {strength:mix(.36,.048,theme(p)),radius:.47,threshold:.86};},
    resize(width,height,dpr){w=width;h=height;pixelRatio=dpr;},
    update(p,t,dt,ptr){
      const light=theme(p),portrait=Math.max(0,1-Math.min(1,w/h)),narrow=smooth(0,.57,portrait);
      const width=mix(plot.width,3.37,narrow);
      cameraPose(p,camera.position,aim);
      const evX=Math.min(15.2,secBandX(p,0)),protX=secBandX(p,1);
      const peaks=(evX+protX)*.5;
      let shift=(peaks-aim.x)*smooth(.48,.535,p)*(1.-smooth(.632,.698,p));
      shift+=(plot.center-aim.x)*smooth(.644,.702,p);
      camera.position.x+=shift*narrow;aim.x+=shift*narrow;
      direction.subVectors(camera.position,aim);
      camera.position.addScaledVector(direction,narrow*mix(.42,.69,smooth(.65,.79,p)));
      camera.position.y+=narrow*.46*(1.-smooth(.65,.76,p));
      camera.lookAt(aim);camera.updateMatrixWorld();
      const focus=camera.position.distanceTo(aim);
      scene.background.copy(dark).lerp(clean,light);
      const bu=bg.material.uniforms;bu.light.value=light;bu.cool.value=smooth(.69,.78,p);bu.aspect.value=w/h;
      outlet.set(secPlace.x+secPlace.scale*3.6,0,0).project(camera);
      bu.glow.value.set(THREE.MathUtils.clamp(outlet.x,-1.4,1.4),THREE.MathUtils.clamp(outlet.y,-1.2,1.2));
      far.update(smooth(.17,.245,p)*(1.-smooth(.43,.49,p)),w/h,p);
      scene.fog.color.copy(scene.background);scene.fog.density=mix(.075,.016,light);
      show(filter,smooth(.096,.147,p)*(1.-smooth(.216,.27,p)));
      rimMaterial.opacity=filter.material.uniforms.opacity.value*.85;
      const membraneAlpha=smooth(.178,.252,p)*(1.-smooth(.465,.51,p));
      show(wall,membraneAlpha);
      for(const m of neighbours)show(m,membraneAlpha*.88);
      secFade.value=smooth(.445,.50,p)*(1.-smooth(.655,.70,p));
      column.group.visible=secFade.value>.003;column.update(p,t,light,camera);
      field.scale.x=mix(1.,.624,narrow);
      show(field,smooth(.656,.695,p)*(1.-smooth(.739,.798,p)));
      axis.update(width,smooth(.754,.808,p)*(1.-smooth(.938,.979,p)));
      const uni=dust.uniforms;
      uni.uTime.value=t;uni.uLight.value=light;uni.uFocus.value=focus;uni.uPlotWidth.value=width;
      uni.uFieldWidth.value=field.scale.x;
      uni.uPixels.value=h*pixelRatio*.5*camera.projectionMatrix.elements[5];
      mouse.set(ptr.x,ptr.y,.5).unproject(camera).sub(camera.position).normalize();
      const ray=-camera.position.z/Math.min(-.001,mouse.z);
      const hitX=camera.position.x+mouse.x*ray,hitY=camera.position.y+mouse.y*ray;
      uni.uHover.value=(hitX-plot.center)/width;
      uni.uHoverOn.value=hasPointer && hitY>plot.base-.28 && hitY<plot.base+plot.height+.42 ? 1 : 0;
      dust.update(p);
      const fx=mix(-1.9,1.65,smooth(.24,.475,p));
      labels[0].pos.set(fx-.53,1.06,.38);labels[1].pos.set(fx+.40,-.15,.35);labels[2].pos.set(fx+1.12,-1.62,.69);
      labels[3].pos.set(mix(8.2,11.6,smooth(.48,.66,p)),1.75,.55);
      labels[4].pos.set(evX,1.05,.9);labels[5].pos.set(protX,-1.05,.9);
    }};
}
