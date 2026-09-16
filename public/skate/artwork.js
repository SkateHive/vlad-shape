// Original uploaded artwork is retained byte-for-byte in assets.
// These canvases map it onto the curved deck without the photo's white backdrop.
import {createGriptape} from './griptape.js';
export const LOGO_PLACEMENT=Object.freeze({size:.32,x:0,z:-2.12});
export function composeArtwork(T,logo,reference,makeCanvas=(w,h)=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}){
  const width=1024,height=4096,deckWidth=2.0955,deckLength=8.1;
  const grip=makeCanvas(width,height),gc=grip.getContext('2d');
  const abrasive=createGriptape(T),grit=gc.createImageData(width,height);
  grit.data.set(abrasive.gripMap.image.data);
  gc.putImageData(grit,0,0);
  abrasive.gripMap.dispose();
  const {size,x,z}=LOGO_PLACEMENT,w=size/deckWidth*width,h=size/deckLength*height;
  // Top-face U runs toward -X, so the lettering reads correctly from above.
  gc.imageSmoothingEnabled=false;
  gc.drawImage(logo,(.5-x/deckWidth)*width-w/2,(.5-z/deckLength)*height-h/2,w,h);

  const source=makeCanvas(reference.width,reference.height),sc=source.getContext('2d');
  sc.drawImage(reference,0,0);const pixels=sc.getImageData(0,0,source.width,source.height).data;
  const graphic=makeCanvas(width,height),bc=graphic.getContext('2d');
  const print=bc.createImageData(width,height),out=print.data;
  // Normalize the source silhouette row by row to the existing popsicle outline.
  // The screen, circuits, wires and lettering remain the supplied photograph.
  const sx=source.width/1568,sy=source.height/1592,top=35*sy,bottom=1566*sy;
  const halfWidth=z=>Math.abs(z)>3?deckWidth/2*Math.sqrt(Math.max(0,1-((Math.abs(z)-3)/1.05)**2)):deckWidth/2-.022*Math.cos(z/3*Math.PI/2)**2;
  const bounds=[];
  for(let sourceY=Math.floor(top);sourceY<=Math.ceil(bottom);sourceY++){
    let left=-1,right=-1;
    for(let col=Math.round(550*sx);col<Math.round(1010*sx);col++){
      const p=(sourceY*source.width+col)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];
      if(r>105&&g<r*.74&&b<r*.8){if(left<0)left=col;right=col;}
    }
    bounds.push({left,right});
  }
  // Circuit tabs and plugs obscure the red border for short spans. A local
  // median follows the deck contour without mistaking those objects for edges.
  const edgeAt=(index,key)=>{
    const radius=Math.min(75,index,bounds.length-1-index),values=[];
    for(let i=index-radius;i<=index+radius;i++)if(bounds[i][key]>=0)values.push(bounds[i][key]);
    values.sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]:-1;
  };
  const outline=bounds.map((_,i)=>({left:edgeAt(i,'left'),right:edgeAt(i,'right')}));
  for(let row=0;row<height;row++){
    const t=(row+.5)/height,sourceY=Math.min(source.height-1,Math.round(top+(bottom-top)*t));
    const {left,right}=outline[sourceY-Math.floor(top)];
    if(right-left<4){for(let col=0;col<width;col++){const p=(row*width+col)*4;out[p]=220;out[p+1]=9;out[p+2]=32;out[p+3]=255;}continue;}
    const edge=(sourceY*source.width+Math.min(right,left+3))*4;
    const span=halfWidth(4.05-t*8.1)/(deckWidth/2)*width;
    const start=(width-span)/2;
    for(let col=0;col<width;col++){
      const p=(row*width+col)*4;
      if(col<start||col>=start+span){out[p]=pixels[edge];out[p+1]=pixels[edge+1];out[p+2]=pixels[edge+2];}
      else{
        const sample=left+1+(col-start)/span*(right-left-2),a=Math.floor(sample),f=sample-a,q=(sourceY*source.width+a)*4;
        for(let channel=0;channel<3;channel++)out[p+channel]=pixels[q+channel]*(1-f)+pixels[q+4+channel]*f;
      }
      out[p+3]=255;
    }
  }
  bc.putImageData(print,0,0);
  const map=canvas=>{const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.anisotropy=8;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;return t;};
  return{gripMap:map(grip),gripSurfaceMap:abrasive.gripSurfaceMap,graphicMap:map(graphic)};
}

export async function loadSkateArtwork(T){
  const load=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Não foi possível carregar a arte do skate.'));image.src=new URL(url,import.meta.url).href;});
  const [logo,reference]=await Promise.all([load('./assets/skatehive-logo.png'),load('./assets/red-board-reference.png')]);
  return composeArtwork(T,logo,reference);
}
