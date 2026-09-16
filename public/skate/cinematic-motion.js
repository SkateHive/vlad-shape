// Scroll-controlled camera-space flight paths. Geometry stays at its real size.
// Every frame starts from the mechanical pose, so reverse scrolling is exact.
export const SCROLL_PHASES=Object.freeze({burstEnd:.76,settleStart:.77,settleEnd:.98});
export function createCinematicMotion(T,model,camera){
  const clamp=T.MathUtils.clamp,smooth=(a,b,p)=>{const t=clamp((p-a)/(b-a),0,1);return t*t*(3-2*t);};
  const axisY=new T.Vector3(0,1,0),outer=new T.Quaternion(),orbit=new T.Quaternion();
  const cameraQ=new T.Quaternion(),cameraInverseQ=new T.Quaternion(),parentQ=new T.Quaternion();
  const position=new T.Vector3(),destination=new T.Vector3(),centerOffset=new T.Vector3();
  const orientation=new T.Quaternion(),facing=new T.Quaternion(),tumble=new T.Quaternion();
  const euler=new T.Euler(),targets=[];
  const finalOrientation=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0));
  const nonDeckRoots=model.root.children.filter(node=>node!==model.deck).map(node=>({node,visible:node.visible}));
  const faceCamera=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),new T.Vector3(0,0,1));
  model.setExplosion(0);
  function add(node,options){
    const bounds=new T.Box3().setFromObject(node),center=node.worldToLocal(bounds.getCenter(new T.Vector3()));
    const radius=bounds.getSize(new T.Vector3()).length()*.5;
    let depth=0;for(let p=node.parent;p;p=p.parent)depth++;
    targets.push({node,center,radius,depth,position:node.position.clone(),quaternion:node.quaternion.clone(),mechanicalOrientation:new T.Quaternion(),...options});
  }
  // Large foreground wheels arrive on different beats and slide toward the edges.
  const wheelPaths=[
    {x:-.60,y:.20,start:.40,hit:.76,distance:1.25,exitX:-.43,exitY:.08,turns:1.35},
    {x:.64,y:-.17,start:.47,hit:.87,distance:1.45,exitX:.39,exitY:-.10,turns:-1.7},
    {x:.53,y:.70,start:.53,hit:.83,distance:2.05,exitX:.20,exitY:.29,turns:1.9},
    {x:-.40,y:-.66,start:.57,hit:.96,distance:1.80,exitX:-.13,exitY:-.27,turns:-1.4}
  ];
  for(let i=0;i<model.wheels.length;i++)add(model.wheels[i].node,{...wheelPaths[i],kind:'wheel',seed:i,arc:(i%2?-.20:.22)});
  model.bearings.forEach((b,i)=>{
    const a=i*Math.PI*.763+.28;
    add(b.node,{kind:'bearing',seed:i,x:Math.cos(a)*(.67+(i%3)*.14),y:Math.sin(a)*(.57+(i%2)*.25),start:.56+(i%4)*.025,hit:.87+(i%3)*.045,distance:1.18+(i%4)*.34,exitX:Math.cos(a)*.12,exitY:Math.sin(a)*.12,turns:(i%2?1:-1)*(1.3+i*.1),arc:Math.sin(a)*.13});
  });
  model.trucks.forEach((truck,i)=>{
    const side=i===0?-1:1;
    add(truck.node.getObjectByName('Baseplate'),{kind:'metal',seed:i,x:side*.64,y:.68,start:.53,hit:.94,distance:5.5,exitX:side*.08,exitY:.10,turns:side*.55,arc:.18});
    add(truck.hanger,{kind:'metal',seed:i+2,x:side*.63,y:-.37,start:.60,hit:.94,distance:4.1,exitX:side*.15,exitY:-.12,turns:side*.7,arc:-.12});
    const loose=[truck.lower,truck.upper,truck.lowerWasher,truck.upperWasher,truck.kingnut,truck.kingpin,truck.pivotCup];
    loose.forEach((node,j)=>{
      const a=(i*7+j)*2.399+.55;
      add(node,{kind:'small',seed:i*7+j,x:Math.cos(a)*(.45+(j%3)*.22),y:Math.sin(a)*(.46+(j%2)*.25),start:.52+j*.018,hit:.89+(j%3)*.035,distance:2.15+(j%4)*.48,exitX:Math.cos(a)*.1,exitY:Math.sin(a)*.1,turns:side*(.7+j*.16),arc:.12*Math.sin(a)});
    });
  });
  [...model.bolts,...model.nuts].forEach((part,i)=>{
    const a=i*2.399+1.2;
    add(part.node,{kind:'small',seed:i+14,x:Math.cos(a)*(.72+(i%3)*.15),y:Math.sin(a)*(.6+(i%4)*.13),start:.37+(i%5)*.035,hit:.83+(i%4)*.045,distance:1.55+(i%5)*.47,exitX:Math.cos(a)*.16,exitY:Math.sin(a)*.16,turns:(i%2?1:-1)*1.8,arc:.16*Math.cos(a)});
  });
  // Apply parents first; children launch smoothly from their moving parent.
  targets.sort((a,b)=>a.depth-b.depth);
  function reset(){
    for(const item of targets){item.node.position.copy(item.position);item.node.quaternion.copy(item.quaternion);}
    for(const item of nonDeckRoots)item.node.visible=item.visible;
  }
  function update(value,{tilt=-1.08,pitch=0,yaw=0,zoom=1,reducedMotion=false}={}){
    const scrollProgress=clamp(Number(value)||0,0,1),p=Math.min(scrollProgress/SCROLL_PHASES.burstEnd,1);
    const settle=smooth(SCROLL_PHASES.settleStart,SCROLL_PHASES.settleEnd,scrollProgress);
    reset();model.setExplosion(p);
    // Slow the board's orbit as the detached pieces take over the foreground.
    const spinProgress=p<=.42?p:.42+.055*smooth(.42,.82,p);
    outer.setFromEuler(euler.set(tilt+pitch,0,-.60+.12*p));
    orbit.setFromAxisAngle(axisY,.10+(reducedMotion?0:spinProgress*Math.PI*2)+yaw);
    model.root.quaternion.copy(outer).multiply(orbit).slerp(finalOrientation,settle);model.root.position.set(0,-.08*(1-settle),0);
    const approach=Math.sin(Math.min(p/.3,1)*Math.PI)*.4;
    const pullback=smooth(.26,1,p)*(reducedMotion?2.2:.9);
    const tangent=Math.tan(T.MathUtils.degToRad(camera.fov)*.5);
    const finalDistance=Math.max(model.SPEC.deckLength/(2*tangent*.84),model.SPEC.deckWidth/(2*tangent*camera.aspect*.72))-.47;
    const cinematicDistance=(13.3-approach+pullback)*Math.max(1,1.02/camera.aspect)*zoom;
    camera.position.set(0,0,T.MathUtils.lerp(cinematicDistance,finalDistance,settle));
    camera.lookAt(0,0,0);camera.updateMatrixWorld(true);model.root.updateMatrixWorld(true);
    if(scrollProgress===1){for(const item of nonDeckRoots)item.node.visible=false;return;}
    if(reducedMotion&&scrollProgress<=.78)return;
    camera.getWorldQuaternion(cameraQ);cameraInverseQ.copy(cameraQ).invert();
    for(const item of targets)if(item.kind==='wheel')item.node.getWorldQuaternion(item.mechanicalOrientation);
    for(const item of targets){
      const {node}=item,phase=clamp((p-item.start)/(item.hit-item.start),0,1);
      const clear=smooth(.78+(item.seed%4)*.018,.96+(item.seed%4)*.01,scrollProgress);
      const flight=reducedMotion?clear:smooth(0,1,phase);
      if(flight===0)continue;
      const exit=smooth(item.hit,1,p);let screenX=item.x+item.exitX*exit,screenY=item.y+item.exitY*exit;
      // Perspective, rather than object scaling, makes wheels fill the viewport.
      // Adjust the approach for portrait screens; retain clearance from the lens.
      const portrait=Math.max(1,1/Math.max(.2,camera.aspect));
      const nearest=item.kind==='wheel'?Math.max(item.distance,1.28*portrait):item.distance*Math.sqrt(portrait);
      position.copy(item.center).applyMatrix4(node.matrixWorld);
      const naturalDepth=-destination.copy(position).applyMatrix4(camera.matrixWorldInverse).z;
      const distance=Math.max((reducedMotion?naturalDepth:nearest*(1+exit*.10)*zoom)*(1+clear*.18),item.radius+camera.near+.24);
      // Move the whole bounding sphere beyond an edge before hiding its root.
      // The padding includes depth, zoom and portrait aspect ratio.
      const extent=1.25+item.radius/(Math.max(.15,distance-item.radius)*tangent*Math.min(1,camera.aspect));
      const direction=Math.max(Math.abs(item.x),Math.abs(item.y));
      screenX=T.MathUtils.lerp(screenX,item.x/direction*extent,clear);
      screenY=T.MathUtils.lerp(screenY,item.y/direction*extent,clear);
      destination.set(screenX*distance*tangent*camera.aspect,(screenY+item.arc*Math.sin(phase*Math.PI))*distance*tangent,-distance).applyMatrix4(camera.matrixWorld);
      position.lerp(destination,flight);
      node.getWorldQuaternion(orientation);
      // Wheels launch before their hangers tumble. Face the lens from their
      // mechanical orientation; nested bearings inherit continuous parent spin.
      // Blending a spinning parent's wrapped quaternion would cause 180° snaps.
      if(!reducedMotion&&item.kind==='wheel'){
        facing.copy(cameraQ).multiply(faceCamera);
        orientation.copy(item.mechanicalOrientation).slerp(facing,flight);
      }
      if(!reducedMotion){
        const spin=phase*item.turns*Math.PI*2*flight,seed=item.seed;
        if(item.kind==='wheel')euler.set(Math.sin(phase*3+seed)*.24*flight,Math.cos(phase*4+seed)*.32*flight,spin);
        else euler.set(spin*.63,spin*.41,spin);
        tumble.setFromEuler(euler).premultiply(cameraQ).multiply(cameraInverseQ);
        orientation.premultiply(tumble);
      }
      node.parent.getWorldQuaternion(parentQ);node.quaternion.copy(parentQ.invert().multiply(orientation));
      node.parent.worldToLocal(position);
      centerOffset.copy(item.center).multiply(node.scale).applyQuaternion(node.quaternion);
      node.position.copy(position).sub(centerOffset);node.updateWorldMatrix(false,true);
    }
  }
  return{update,reset,targets};
}
