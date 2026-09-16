// Deterministic abrasive grains at physical scale, with matching color and relief.
// R stores height and G stores roughness in the shared linear surface texture.
export function createGriptape(T){
  const width=1024,height=4096,color=new Uint8Array(width*height*4),surface=new Uint8Array(color.length);
  let seed=94317;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<color.length;i+=4){
    const noise=random(),value=17+noise*11;
    color[i]=value;color[i+1]=value+1;color[i+2]=value;color[i+3]=255;
    surface[i]=10+noise*13;surface[i+1]=246+noise*9;surface[i+2]=0;surface[i+3]=255;
  }
  // Approximately 0.53 mm between grains in both directions: no lengthwise stretch.
  const pitchX=.53/(209.55/width),pitchY=.53/(810/height);
  for(let row=-1;row<=Math.ceil(height/pitchY);row++)for(let col=-1;col<=Math.ceil(width/pitchX);col++){
    const cx=(col+random())*pitchX,cy=(row+random())*pitchY;
    const radius=.38+random()*.28,rx=radius/(209.55/width),ry=radius/(810/height);
    const rotation=random()*Math.PI,cs=Math.cos(rotation),sn=Math.sin(rotation);
    const stretch=.72+random()*.42,peak=.44+random()*.56,tone=25+random()*24;
    const reach=Math.max(rx,ry)*1.55;
    for(let y=Math.max(0,Math.floor(cy-reach));y<=Math.min(height-1,Math.ceil(cy+reach));y++){
      for(let x=Math.max(0,Math.floor(cx-reach));x<=Math.min(width-1,Math.ceil(cx+reach));x++){
        const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry;
        const u=Math.abs((dx*cs+dy*sn)/stretch),v=Math.abs(-dx*sn+dy*cs);
        const edge=Math.max(u,v)*.82+Math.min(u,v)*.36;
        if(edge>=1)continue;
        const relief=peak*Math.sqrt(1-edge),elevation=22+Math.round(relief*186),i=(y*width+x)*4;
        if(elevation<=surface[i])continue;
        surface[i]=elevation;surface[i+1]=Math.round(248-relief*29);
        const value=tone+relief*13;
        color[i]=value;color[i+1]=value+1;color[i+2]=value;color[i+3]=255;
      }
    }
  }
  const texture=(pixels,isColor)=>{
    const t=new T.DataTexture(pixels,width,height,T.RGBAFormat);
    t.colorSpace=isColor?T.SRGBColorSpace:T.NoColorSpace;
    t.flipY=true;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;
    t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;
    t.anisotropy=8;t.needsUpdate=true;return t;
  };
  return{gripMap:texture(color,true),gripSurfaceMap:texture(surface,false)};
}
