import {MarchingCubes} from './vendor/MarchingCubes.js';
import {createGriptape} from './griptape.js';
// Decimeters: X transverse, Y deck normal, Z length.
const TRUCK_REFERENCE_DECK_THICKNESS=.107;
export const SPEC=Object.freeze({deckLength:8.10,deckWidth:2.0955,deckThickness:(.107/7)*6,deckPlies:6,mountCenters:[-2.12,2.12],boltX:.206,boltZ:.270,baseWidth:.615,baseLength:.775,kingpinTiltDegrees:15,wheelRadius:.27,wheelWidth:.32,wheelCenterX:.84775,axleHalfLength:1.04775,axleRadius:.04,bearingOuterRadius:.11,bearingInnerRadius:.04,bearingWidth:.07,hangerWidth:1.39});
export function createSkateboard(T,artwork={}){
const root=new T.Group();root.name='Skate';const parts=[],trucks=[],wheels=[],bearings=[],bolts=[],nuts=[],cushions=[];
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),group=(p,n)=>{const g=new T.Group();g.name=n;p.add(g);return g;};
const smooth=(a,b,t)=>{const u=T.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
let seed=57129;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function texture(w,h,fn,color=true){const data=new Uint8Array(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const c=fn(i/w,j/h),p=(j*w+i)*4;data[p]=c[0];data[p+1]=c[1];data[p+2]=c[2];data[p+3]=255;}const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;}
const wood=texture(512,2048,(u,w)=>{const bend=Math.sin(w*8+u*3)*.006+Math.sin(w*19)*.002,g=Math.sin((u+bend)*870+Math.sin(u*37+w*4)*2)*2.5+Math.sin((u+bend)*180)*3+Math.sin(u*27+w*1.2)*4+(rand()-.5)*4;return[214+g,180+g*.86,131+g*.64];});
const abrasive=artwork.gripMap&&artwork.gripSurfaceMap?artwork:createGriptape(T);
const grip=artwork.gripMap||abrasive.gripMap,gripSurface=artwork.gripSurfaceMap||abrasive.gripSurfaceMap;
if(artwork.gripMap&&abrasive!==artwork)abrasive.gripMap.dispose();
const grain=texture(256,256,()=>{const c=100+rand()*85;return[c,c,c];},false),fine=texture(256,256,()=>{const c=125+rand()*20;return[c,c,c];},false);
const physical=p=>new T.MeshPhysicalMaterial(p),mats={wood:physical({map:artwork.graphicMap||wood,roughness:artwork.graphicMap ? .40 : .42,clearcoat:.23,clearcoatRoughness:.3}),grip:physical({map:grip,bumpMap:gripSurface,bumpScale:.0024,roughnessMap:gripSurface,roughness:1}),silver:physical({color:0xc5c8cb,metalness:1,roughness:.39,bumpMap:grain,bumpScale:.0007}),base:physical({color:0xbfc3c6,metalness:1,roughness:.37,bumpMap:grain,bumpScale:.0005}),machined:physical({color:0xc9ccce,metalness:1,roughness:.26}),steel:physical({color:0xc8cdd0,metalness:1,roughness:.19}),dark:physical({color:0x343a3c,metalness:.83,roughness:.32}),ivory:physical({color:0xf2e7cc,roughness:.43,bumpMap:fine,bumpScale:.0005,clearcoat:.08,clearcoatRoughness:.5}),bushing:physical({color:0x9d231d,roughness:.48,clearcoat:.16,clearcoatRoughness:.4}),nylon:physical({color:0x202323,roughness:.83}),shield:physical({color:0x586260,metalness:.68,roughness:.31}),cage:physical({color:0x847656,metalness:.9,roughness:.3})};
function mesh(g,m,p,n){const o=new T.Mesh(g,m);o.name=n;o.userData.part=n;o.castShadow=true;o.receiveShadow=true;p.add(o);parts.push(o);return o;}
function lathe(p,points,axis,mat,name,segments=64){const m=mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),segments),mat,p,name);m.quaternion.setFromUnitVectors(v(0,1,0),axis);return m;}
function ring(p,center,axis,r,R,length,mat,name){const e=Math.min(.002,length/5),h=length/2,m=lathe(p,[[R,-h+e],[R+e,-h],[r-e,-h],[r,-h+e],[r,h-e],[r-e,h],[R+e,h],[R,h-e],[R,-h+e]],axis,mat,name,48);m.position.copy(center);return m;}
function cylinder(p,a,b,r1,r2,mat,name){const d=b.clone().sub(a),m=mesh(new T.CylinderGeometry(r2,r1,d.length(),48),mat,p,name);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());return m;}
function hex(p,center,axis,r,h,mat,name){const s=new T.Shape();for(let j=0;j<6;j++){const a=j*Math.PI/3;j?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r);}s.closePath();const hole=new T.Path();hole.absarc(0,0,r*.51,0,Math.PI*2,true);s.holes.push(hole);const g=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSize:.0025,bevelThickness:.0025,bevelSegments:3,curveSegments:12});g.translate(0,0,-h/2);const m=mesh(g,mat,p,name);m.position.copy(center);m.quaternion.setFromUnitVectors(v(0,0,1),axis);return m;}
function thread(p,a,axis,length,r,pitch,name){const pts=[],turns=length/pitch,steps=Math.ceil(turns*24),u=v(1,0,0);if(Math.abs(axis.x)>.8)u.set(0,1,0);u.addScaledVector(axis,-u.dot(axis)).normalize();const w=v().crossVectors(axis,u);for(let i=0;i<=steps;i++){const t=i/steps,angle=t*turns*Math.PI*2;pts.push(a.clone().addScaledVector(axis,t*length).addScaledVector(u,Math.cos(angle)*r).addScaledVector(w,Math.sin(angle)*r));}return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),steps,.0018,4,false),mats.steel,p,name);}
function roundedRect(w,h,r){const s=new T.Shape(),x=-w/2,z=-h/2;s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);s.lineTo(x+w,z+h-r);s.quadraticCurveTo(x+w,z+h,x+w-r,z+h);s.lineTo(x+r,z+h);s.quadraticCurveTo(x,z+h,x,z+h-r);s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;}
const hw=SPEC.deckWidth/2,halfWidth=z=>Math.abs(z)>3?hw*Math.sqrt(Math.max(0,1-((Math.abs(z)-3)/1.05)**2)):hw-.022*Math.cos(z/3*Math.PI/2)**2;
const surface=(x,z)=>{const k=Math.max(0,(Math.abs(z)-(z>0?2.53:2.63))/(z>0?1.52:1.42));return Math.pow(k,1.85)*(z>0?.49:.425)+.066*(x/hw)**2;};
const deck=group(root,'Shape — '+SPEC.deckPlies+' lâminas de maple'),holes=[];for(const z of SPEC.mountCenters)for(const x of [-SPEC.boltX,SPEC.boltX])for(const dz of [-SPEC.boltZ,SPEC.boltZ])holes.push([x,z+dz]);
const nx=56,nz=240,outline=[];
for(let j=0;j<=nz;j++){const z=-4.05+8.1*j/nz;outline.push(new T.Vector2(halfWidth(z),z));}
for(let j=nz-1;j>0;j--){const z=-4.05+8.1*j/nz;outline.push(new T.Vector2(-halfWidth(z),z));}
function surfaceGeometry(offset,reverse,radius){
 const points=[],pos=[],uv=[],idx=[],stride=nx+1;
 const patches=holes.map(([x,z])=>{const w=halfWidth(z);return{x,z,i0:Math.floor(((x-.065)/w+1)*nx/2),i1:Math.ceil(((x+.065)/w+1)*nx/2),j0:Math.floor((z-.07+4.05)/8.1*nz),j1:Math.ceil((z+.07+4.05)/8.1*nz)};});
 const addPoint=(x,z)=>{points.push(new T.Vector2(x,z));pos.push(x,surface(x,z)+offset,z);uv.push((reverse?x:-x)/SPEC.deckWidth+.5,(z+4.05)/8.1);return points.length-1;};
 for(let j=0;j<=nz;j++){const z=-4.05+8.1*j/nz,w=halfWidth(z);for(let i=0;i<=nx;i++)addPoint((i/nx*2-1)*w*(1-.009/hw),z*(1-.009/4.05));}
 const triangle=(a,b,c)=>{const p=points[a],q=points[b],r=points[c],cross=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);if(Math.abs(cross)<1e-12)return;idx.push(...((cross>0)!==reverse?[a,c,b]:[a,b,c]));};
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){if(patches.some(p=>i>=p.i0&&i<p.i1&&j>=p.j0&&j<p.j1))continue;const a=j*stride+i,b=a+1,c=a+stride,d=c+1;triangle(a,b,c);triangle(b,d,c);}
 for(const p of patches){const ids=[];for(let i=p.i0;i<p.i1;i++)ids.push(p.j0*stride+i);for(let j=p.j0;j<p.j1;j++)ids.push(j*stride+p.i1);for(let i=p.i1;i>p.i0;i--)ids.push(p.j1*stride+i);for(let j=p.j1;j>p.j0;j--)ids.push(j*stride+p.i0);
 const contour=ids.map(i=>points[i]),hole=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;hole.push(new T.Vector2(p.x+radius*Math.cos(a),p.z+radius*Math.sin(a)));}const faces=T.ShapeUtils.triangulateShape(contour,[hole]),local=ids.concat(hole.map(p=>addPoint(p.x,p.y)));for(const [a,b,c] of faces)triangle(local[a],local[b],local[c]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
mesh(surfaceGeometry(.003,false,.042),mats.grip,deck,'Lixa');mesh(surfaceGeometry(-SPEC.deckThickness,true,.025),mats.wood,deck,artwork.graphicMap?'Arte vermelha · Skatehive':'Maple envernizado');
const plies=[0xd9b881,0xc39e68,0xdac08c,0xdfc18a,0xc5a16c,0xd8b780];for(let layer=0;layer<SPEC.deckPlies;layer++){const pos=[],uv=[],idx=[],steps=4;for(let i=0;i<=outline.length;i++){const p=outline[i%outline.length];for(let j=0;j<=steps;j++){const t=(layer+j/steps)/SPEC.deckPlies,inset=.010*(Math.abs(t-.5)*2)**4,x=p.x*(1-inset/hw),z=p.y*(1-inset/4.05);pos.push(x,surface(x,z)-t*SPEC.deckThickness,z);uv.push(i/outline.length,t);}}for(let i=0;i<outline.length;i++)for(let j=0;j<steps;j++){const a=i*(steps+1)+j,b=a+steps+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();mesh(g,physical({color:plies[layer],roughness:.5,side:T.DoubleSide}),deck,'Lâmina de maple '+(layer+1));}
for(const [x,z] of holes){const wall=lathe(deck,[[.042,.003],[.025,-.028],[.025,-SPEC.deckThickness]],v(0,1,0),physical({color:0xb08c60,roughness:.75,side:T.DoubleSide}),'Furo escareado',32);wall.position.set(x,surface(x,z),z);}
// Cast hanger in (axle, shoulder, deck-normal) coordinates. The web sweeps
// toward the baseplate: it is not a planar triangle perpendicular to the kingpin.
const seatV=.310,seatN=.070;
function castHanger(){
 const n=112,mc=new MarchingCubes(n,mats.silver,false,false,170000);mc.isolation=0;
 const lo=[-.78,-.145,-.155],hi=[.78,.515,.420],size=hi.map((x,i)=>x-lo[i]);
 const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
 const intersect=(a,b)=>Math.min(Math.max(a,b),0)+Math.hypot(Math.max(a,0),Math.max(b,0));
 // Curved shoulders narrow rapidly into a compact, round bushing yoke.
 const width=y=>.148+.42*Math.exp(-Math.max(0,y+.014)*8.3);
 let index=0;
 for(let k=0;k<n;k++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=lo[0]+i/n*size[0],y=lo[1]+j/n*size[1],z=lo[2]+k/n*size[2];
  const r=.100-.023*Math.min(1,Math.abs(x)/.65)**1.6;
  let d=intersect(Math.hypot(y,z)-r+.007,Math.abs(x)-.688)-.007;
  const w=width(y),across=Math.min(1,Math.abs(x)/w);
  const center=seatN*smooth(-.005,seatV,y);
  const thickness=.026+.012*(1-across*across)+.009*Math.exp(-(((across-.83)/.19)**2));
  const outline=Math.max(Math.abs(x)-w,-.016-y,y-.360);
  const web=intersect(outline,Math.abs(z-center)-thickness)-.008;
  d=smin(d,web,.034);
  // Rounded seat with a machined bore and thicker load-bearing outer lip.
  const boss=intersect(Math.hypot(x,y-seatV)-.157,Math.abs(z-seatN)-.035)-.008;
  d=smin(d,boss,.026);
  // A broad triangular buttress rises into the pivot arm, with a round socket tip.
  const finWidth=.046+.53*Math.pow(Math.max(0,1-Math.max(0,z)/.295),2);
  const finCenter=.014+Math.max(0,z)*.14;
  const fin=intersect(Math.max(Math.abs(x)-finWidth,-.010-z,z-.275),Math.abs(y-finCenter)-.034)-.009;
  d=smin(d,fin,.026);
  const t=T.MathUtils.clamp(((y-.005)*.055+(z-.020)*.290)/(.055*.055+.290*.290),0,1);
  const pivot=Math.hypot(x,y-(.005+.055*t),z-(.020+.290*t))-(.083-.028*t);
  d=smin(d,pivot,.032);
  // Closed-bottom weight-relief pockets leave perimeter ribs and an intact axle core.
  const wingWell=(Math.sqrt(((Math.abs(x)-.365)/.272)**2+((y-.040)/.145)**2+((z-.118)/.102)**2)-1)*.102;
  d=Math.max(d,-wingWell);
  // Keep the pivot buttress solid; the lightening wells stay in the axle wings.
  d=smin(d,fin,.022);
  d=smin(d,pivot,.025);
  const axleCore=intersect(Math.hypot(y,z)-.056,Math.abs(x)-.682);
  d=smin(d,axleCore,.008);
  // Seat hole opens out into a scalloped kingpin clearance pocket on the road side.
  // Leave the full steel axle supported inside the continuous rear grind beam.
  const flare=.106+.061*smooth(.045,-.085,z);
  const bore=flare-Math.hypot(x,y-seatV);
  d=Math.max(d,bore);
  const pocket=(Math.sqrt((x/.165)**2+((y-.205)/.137)**2+((z+.025)/.121)**2)-1)*.121;
  d=Math.max(d,-pocket);
  mc.field[index++]=-d;
 }
 mc.update();const g=new T.BufferGeometry();
 g.setAttribute('position',new T.BufferAttribute(mc.positionArray.slice(0,mc.count*3),3));
 g.setAttribute('normal',new T.BufferAttribute(mc.normalArray.slice(0,mc.count*3),3));
 g.scale(size[0]/2,size[1]/2,size[2]/2);g.translate((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2);
 const uv=new Float32Array(mc.count*2),p=g.attributes.position;
 for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*4;uv[i*2+1]=p.getY(i)*4;}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));mc.geometry.dispose();return g;
}
const hangerGeometry=castHanger();
function makeBearing(parent,side){const b=group(parent,'Rolamento 608 · 8 × 22 × 7 mm');b.position.x=side*.085;const axis=v(1,0,0);ring(b,v(),axis,.110,.090,.070,mats.steel,'Pista externa');ring(b,v(),axis,.057,.040,.070,mats.steel,'Pista interna');const balls=group(b,'Sete esferas de aço'),ballGeo=new T.SphereGeometry(.0185,16,12);for(let i=0;i<7;i++){const a=i/7*Math.PI*2,m=mesh(ballGeo,mats.steel,balls,'Esfera de aço');m.position.set(0,Math.cos(a)*.074,Math.sin(a)*.074);}for(const s of [-1,1])ring(b,v(s*.013,0,0),axis,.078,.070,.003,mats.cage,'Gaiola do rolamento');const shields=[];for(const s of [-1,1]){const sh=ring(b,v(s*.031,0,0),axis,.091,.057,.004,mats.shield,'Blindagem do rolamento');shields.push({node:sh,home:sh.position.clone(),side:s});ring(b,v(s*.035,0,0),axis,.107,.102,.0018,mats.steel,'Canal da pista externa');}const info={node:b,side,home:b.position.clone(),shields};bearings.push(info);return info;}
const wheelProfile=[[.110,-.120],[.110,-.139],[.121,-.146],[.163,-.153],[.192,-.159],[.220,-.155],[.240,-.142],[.256,-.119],[.267,-.085],[.270,-.063],[.270,.063],[.267,.085],[.256,.119],[.240,.142],[.220,.155],[.192,.159],[.163,.153],[.121,.146],[.110,.139],[.110,.120],[.110,.05],[.071,.05],[.071,-.05],[.110,-.05],[.110,-.120]];
const wheelGeometry=new T.LatheGeometry(wheelProfile.map(p=>new T.Vector2(...p)),96);wheelGeometry.rotateZ(-Math.PI/2);
let baseSupportGeometry;
function castBaseSupports(anchor,axis,pivot){
 const n=64,mc=new MarchingCubes(n,mats.base,false,false,50000);mc.isolation=0;
 const lo=[-.185,-.335,-.185],hi=[.185,-.123,pivot.z+.15],span=hi.map((x,i)=>x-lo[i]);
 const blend=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
 const intersect=(a,b)=>Math.min(Math.max(a,b),0)+Math.hypot(Math.max(a,0),Math.max(b,0));
 const foot=v(0,-.160,anchor.z+.027),cap=anchor.clone().addScaledVector(axis,.068),delta=cap.clone().sub(foot),length=delta.length();delta.normalize();
 let k=0;
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const px=lo[0]+x/n*span[0],py=lo[1]+y/n*span[1],pz=lo[2]+z/n*span[2];
  const t=T.MathUtils.clamp((-py-.151)/.108,0,1),r=.134+(.094-.134)*t;
  const pivotSupport=intersect(Math.hypot(px,pz-(pivot.z-.004))-r+.006,Math.abs(py+.205)-.054)-.006;
  const ax=px-foot.x,ay=py-foot.y,az=pz-foot.z,h=ax*delta.x+ay*delta.y+az*delta.z;
  const radial=Math.sqrt(Math.max(0,ax*ax+ay*ay+az*az-h*h)),radius=.140+(.126-.140)*T.MathUtils.clamp(h/length,0,1);
  const pedestal=intersect(radial-radius+.006,Math.abs(h-length/2)-length/2)-.006;
  let d=blend(pivotSupport,pedestal,.033);
  d=Math.max(d,py+.149);
  // Recessed socket for the pivot cup and an inclined bore for the kingpin.
  d=Math.max(d,-Math.max(Math.hypot(px,pz-pivot.z)-.079,py-(pivot.y+.057)));
  const qx=px-anchor.x,qy=py-anchor.y,qz=pz-anchor.z,along=qx*axis.x+qy*axis.y+qz*axis.z;
  d=Math.max(d,.034-Math.sqrt(Math.max(0,qx*qx+qy*qy+qz*qz-along*along)));
  mc.field[k++]=-d;
 }
 mc.update();const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(mc.positionArray.slice(0,mc.count*3),3));g.setAttribute('normal',new T.BufferAttribute(mc.normalArray.slice(0,mc.count*3),3));
 g.scale(span[0]/2,span[1]/2,span[2]/2);g.translate((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2);
 const uv=new Float32Array(mc.count*2);for(let i=0;i<mc.count;i++){uv[2*i]=g.attributes.position.getX(i)*5;uv[2*i+1]=g.attributes.position.getZ(i)*5;}g.setAttribute('uv',new T.BufferAttribute(uv,2));mc.geometry.dispose();return g;
}
function makeTruck(end){
 const mountLift=TRUCK_REFERENCE_DECK_THICKNESS-SPEC.deckThickness;
 const truck=group(root,'Truck '+(end>0?'dianteiro':'traseiro'));truck.position.set(0,mountLift,end*2.12);if(end<0)truck.rotation.y=Math.PI;
 const base=group(truck,'Baseplate'),hanger=group(truck,'Hanger'),kingpin=group(truck,'Kingpin completo'),pivotCup=group(truck,'Pivot cup removível');
 const angle=SPEC.kingpinTiltDegrees*Math.PI/180,axis=v(0,-Math.cos(angle),-Math.sin(angle)),webV=v(0,Math.sin(angle),-Math.cos(angle)),beam=v(0,-.626,.195);
 const eye=beam.clone().addScaledVector(webV,seatV).addScaledVector(axis,-seatN),anchor=eye.clone().addScaledVector(axis,-.284),at=t=>anchor.clone().addScaledVector(axis,t);
 // Follow the cast pivot arm when changing kingpin angle, keeping its tip seated.
 const pivotAxis=webV.clone().multiplyScalar(-.055).addScaledVector(axis,.290).normalize();
 const pivotTip=beam.clone().addScaledVector(webV,.060).addScaledVector(axis,-.310),pivot=pivotTip.clone().addScaledVector(pivotAxis,-.036);
 const boreZ=at((-.132-anchor.y)/axis.y).z;
 const mountingHoles=shape=>{for(const x of [-SPEC.boltX,SPEC.boltX])for(const z of [-SPEC.boltZ,SPEC.boltZ]){const h=new T.Path();h.absarc(x,z,.029,0,Math.PI*2,true);shape.holes.push(h);}const kingpinBore=new T.Path();kingpinBore.absellipse(0,boreZ,.083,.083/Math.cos(angle)+.004,0,Math.PI*2,true);shape.holes.push(kingpinBore);return shape;};
 const slab=(shape,depth,y,bevel,name)=>{const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:4,curveSegments:18});g.rotateX(Math.PI/2);const m=mesh(g,mats.base,base,name);m.position.y=y;return m;};
 // Flat deck contact, round mounting ears, a raised perimeter and two blind pockets.
 slab(mountingHoles(roundedRect(SPEC.baseWidth-.008,SPEC.baseLength-.008,.065)),.027,-TRUCK_REFERENCE_DECK_THICKNESS-.006,.005,'Baseplate · face de montagem');
 const rim=mountingHoles(roundedRect(SPEC.baseWidth,SPEC.baseLength,.069));
 for(const side of [-1,1]){const pocket=roundedRect(.072,.326,.033),path=new T.Path();path.setFromPoints(pocket.getPoints(16).map(p=>new T.Vector2(p.x+side*.236,p.y)));rim.holes.push(path);}
 slab(rim,.025,-.143,.004,'Baseplate · nervuras e rebaixos');
 for(const x of [-SPEC.boltX,SPEC.boltX])for(const z of [-SPEC.boltZ,SPEC.boltZ])ring(base,v(x,-.168,z),v(0,1,0),.074,.031,.013,mats.base,'Assento reforçado de montagem');
if(!baseSupportGeometry)baseSupportGeometry=castBaseSupports(anchor,axis,pivot);mesh(baseSupportGeometry,mats.base,base,'Baseplate · ponte fundida e sede do pivot');
const rubberCup=lathe(pivotCup,[[0,-.032],[.076,-.032],[.079,-.027],[.079,.031],[.076,.036],[.057,.036],[.057,-.021],[0,-.021],[0,-.032]],pivotAxis,mats.nylon,'Pivot cup · copo fechado');rubberCup.position.copy(pivot);
cylinder(kingpin,at(-.033),at(.548),.032,.032,mats.steel,'Kingpin · haste');thread(kingpin,at(.425),axis,.121,.033,.009,'Rosca do kingpin');
const headShape=new T.Shape();for(let j=0;j<6;j++){const a=j*Math.PI/3;j?headShape.lineTo(Math.cos(a)*.077,Math.sin(a)*.077):headShape.moveTo(Math.cos(a)*.077,Math.sin(a)*.077);}headShape.closePath();
const headGeo=new T.ExtrudeGeometry(headShape,{depth:.040,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:3});headGeo.translate(0,0,-.020);
const kingpinHead=mesh(headGeo,mats.steel,kingpin,'Kingpin · cabeça sextavada');kingpinHead.quaternion.setFromUnitVectors(v(0,0,1),axis);kingpinHead.position.copy(at(-.033));
const casting=mesh(hangerGeometry,mats.silver,hanger,'Hanger fundido · 139 mm');casting.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(v(1,0,0),webV,axis.clone().negate()));casting.position.copy(beam);ring(hanger,eye.clone().addScaledVector(axis,-.044),axis,.149,.106,.004,mats.machined,'Assento usinado do amortecedor');cylinder(hanger,v(-SPEC.axleHalfLength,beam.y,beam.z),v(SPEC.axleHalfLength,beam.y,beam.z),.039,.039,mats.steel,'Eixo de aço · 8.25 polegadas');
const lower=group(truck,'Amortecedor inferior'),upper=group(truck,'Amortecedor superior'),lowerWasher=group(truck,'Arruela inferior'),upperWasher=group(truck,'Arruela superior'),kingnut=group(truck,'Porca do kingpin');ring(lowerWasher,at(.081),axis,.140,.035,.014,mats.steel,'Arruela inferior');ring(lower,at(.165),axis,.128,.034,.144,mats.bushing,'Bushing inferior');const cone=lathe(upper,[[.035,-.056],[.113,-.056],[.117,-.047],[.113,-.025],[.097,.046],[.092,.055],[.035,.055],[.035,-.056]],axis,mats.bushing,'Bushing superior cônico');cone.position.copy(at(.380));
const cup=lathe(upperWasher,[[.035,-.006],[.091,-.006],[.106,-.015],[.113,-.013],[.113,-.004],[.102,.007],[.035,.007],[.035,-.006]],axis,mats.steel,'Arruela superior côncava');cup.position.copy(at(.444));
hex(kingnut,at(.486),axis,.078,.057,mats.steel,'Porca do kingpin');ring(kingnut,at(.517),axis,.047,.032,.008,mats.nylon,'Trava de nylon');
for(const side of [-1,1]){ring(hanger,v(side*.708,beam.y,beam.z),v(1,0,0),.069,.041,.008,mats.steel,'Arruela interna do eixo');thread(hanger,v(side*.946,beam.y,beam.z),v(side,0,0),.099,.040,.010,'Rosca helicoidal do eixo');const wheel=group(hanger,'Roda de uretano · 54 mm');wheel.position.set(side*SPEC.wheelCenterX,beam.y,beam.z);mesh(wheelGeometry,mats.ivory,wheel,'Uretano · 54 × 32 mm');const wheelBearings=[makeBearing(wheel,-1),makeBearing(wheel,1)],spacer=ring(wheel,v(),v(1,0,0),.052,.0405,.100,mats.steel,'Espaçador · 10 mm');for(const s of [-1,1])ring(wheel,v(s*.154,0,0),v(1,0,0),.177,.175,.0015,mats.ivory,'Marca de molde');wheels.push({node:wheel,side,home:wheel.position.clone(),bearings:wheelBearings,spacer});const nut=group(hanger,'Porca de eixo');nut.position.set(side*1.012,beam.y,beam.z);ring(nut,v(-side*.037,0,0),v(1,0,0),.067,.041,.008,mats.steel,'Arruela externa do eixo');hex(nut,v(),v(1,0,0),.070,.061,mats.steel,'Porca do eixo');ring(nut,v(side*.031,0,0),v(1,0,0),.045,.035,.007,mats.nylon,'Trava da porca do eixo');nuts.push({node:nut,side,home:nut.position.clone()});}
cushions.push({node:lower,truck,end,kind:'barrel'},{node:upper,truck,end,kind:'cone'});
trucks.push({node:truck,end,home:truck.position.clone(),axis,anchor,eye,pivot,pivotAxis,pivotCup,kingpin,hanger,lower,upper,lowerWasher,upperWasher,kingnut});
for(const [x,dz] of [[-SPEC.boltX,-SPEC.boltZ],[-SPEC.boltX,SPEC.boltZ],[SPEC.boltX,-SPEC.boltZ],[SPEC.boltX,SPEC.boltZ]]){const bolt=group(root,'Parafuso de montagem'),z=end*2.12+dz;bolt.position.set(x,surface(x,z)+.003,z);cylinder(bolt,v(0,-.225+mountLift,0),v(0,-.023,0),.021,.021,mats.dark,'Parafuso de montagem');cylinder(bolt,v(0,-.027,0),v(0,-.004,0),.023,.041,mats.dark,'Cabeça escareada');const head=new T.Shape();head.absarc(0,0,.041,0,Math.PI*2,false);const slot=new T.Path(),s=.006,l=.025;slot.moveTo(-s,-l);slot.lineTo(s,-l);slot.lineTo(s,-s);slot.lineTo(l,-s);slot.lineTo(l,s);slot.lineTo(s,s);slot.lineTo(s,l);slot.lineTo(-s,l);slot.lineTo(-s,s);slot.lineTo(-l,s);slot.lineTo(-l,-s);slot.lineTo(-s,-s);slot.closePath();head.holes.push(slot);const hg=new T.ExtrudeGeometry(head,{depth:.005,bevelEnabled:false,curveSegments:12});hg.rotateX(-Math.PI/2);hg.translate(0,-.004,0);mesh(hg,mats.dark,bolt,'Encaixe Phillips rebaixado');thread(bolt,v(0,-.219+mountLift,0),v(0,1,0),.12-mountLift,.0215,.008,'Rosca do parafuso');bolts.push({node:bolt,home:bolt.position.clone()});hex(base,v(x,-.197,dz),v(0,1,0),.047,.037,mats.dark,'Porca de montagem');}}
makeTruck(1);makeTruck(-1);
function setExplosion(p){
 const lift=smooth(.10,.56,p),drop=smooth(.17,.64,p),wheelOut=smooth(.34,.80,p),bearingOut=smooth(.57,1,p),nutOut=smooth(.30,.70,p),boltOut=smooth(.04,.43,p);
 deck.position.y=lift*.56;
 for(const t of trucks){
  t.node.position.copy(t.home);t.node.position.y-=drop*.64;
  // Release the outside hardware first, then separate the stack along its kingpin.
  t.kingnut.position.copy(t.axis).multiplyScalar(1.48*smooth(.38,.71,p));
  t.upperWasher.position.copy(t.axis).multiplyScalar(1.27*smooth(.42,.77,p));
  t.upper.position.copy(t.axis).multiplyScalar(1.10*smooth(.46,.83,p));
  t.hanger.position.copy(t.axis).multiplyScalar(.75*smooth(.50,.88,p));
  t.lower.position.copy(t.axis).multiplyScalar(.38*smooth(.54,.94,p));
  t.lowerWasher.position.copy(t.axis).multiplyScalar(.17*smooth(.58,.98,p));
  t.pivotCup.position.copy(t.pivotAxis).multiplyScalar(.23*smooth(.63,.95,p));
  t.kingpin.position.copy(t.axis).multiplyScalar(-.76*smooth(.76,1,p));
 }
 for(const w of wheels){w.node.position.copy(w.home);w.node.position.x+=w.side*wheelOut*.96;}
 for(const b of bearings){b.node.position.copy(b.home);b.node.position.x+=b.side*bearingOut*.37;}
 for(const n of nuts){n.node.position.copy(n.home);n.node.position.x+=n.side*(wheelOut*.96+nutOut*.76);}
 for(const b of bolts){b.node.position.copy(b.home);b.node.position.y+=lift*.56+boltOut*.40;}
 root.updateMatrixWorld(true);
}
setExplosion(0);return{root,parts,trucks,wheels,bearings,bolts,nuts,cushions,deck,setExplosion,SPEC};
}
