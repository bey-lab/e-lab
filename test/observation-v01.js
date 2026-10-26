/* E-lab Observation Instruments v0.1
   Local, approximate, descriptive image measurements.
   No rating; no image data is uploaded. */
(function(g){'use strict';
const SIZE=200, GRID=8;
function load(blob){return new Promise((ok,no)=>{const url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);ok(im)};im.onerror=()=>{URL.revokeObjectURL(url);no(Error('画像を読み取れませんでした'))};im.src=url})}
function sample(im){
 const c=document.createElement('canvas');c.width=c.height=SIZE;
 const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,SIZE,SIZE);
 const ratio=Math.min(SIZE/im.naturalWidth,SIZE/im.naturalHeight),w=im.naturalWidth*ratio,h=im.naturalHeight*ratio;
 x.drawImage(im,(SIZE-w)/2,(SIZE-h)/2,w,h);
 return x.getImageData(0,0,SIZE,SIZE).data;
}
const brightness=(p,i)=>.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];
function complexity(p){
 let total=0,n=0;const cells=new Array(GRID*GRID).fill(0),counts=new Array(cells.length).fill(0);
 for(let y=1;y<SIZE-1;y+=2)for(let x=1;x<SIZE-1;x+=2){
  const i=4*(y*SIZE+x),gx=Math.abs(brightness(p,i+4)-brightness(p,i-4)),gy=Math.abs(brightness(p,i+SIZE*4)-brightness(p,i-SIZE*4));
  const val=Math.min(255,(gx+gy)/2),ci=Math.floor(y*GRID/SIZE)*GRID+Math.floor(x*GRID/SIZE);
  total+=val;n++;cells[ci]+=val;counts[ci]++;
 }
 return {amount:total/Math.max(1,n),cells:cells.map((v,i)=>v/Math.max(1,counts[i]))};
}
function compare(a,b,originalA,originalB){
 const cells=new Array(GRID*GRID).fill(0),counts=new Array(cells.length).fill(0);
 let changed=0,valid=0,sum=0;
 const c=document.createElement('canvas');c.width=c.height=SIZE;
 const x=c.getContext('2d'),out=x.createImageData(SIZE,SIZE);
 for(let y=0;y<SIZE;y++)for(let col=0;col<SIZE;col++){
  const i=4*(y*SIZE+col),difference=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
  const cell=Math.floor(y*GRID/SIZE)*GRID+Math.floor(col*GRID/SIZE);
  counts[cell]++;cells[cell]+=difference;
  if(difference>36)changed++;
  valid++;sum+=difference;
  out.data[i]=Math.round(44+difference*.8);out.data[i+1]=Math.round(48+difference*.05);out.data[i+2]=Math.round(82+difference*.10);out.data[i+3]=255;
 }
 x.putImageData(out,0,0);
 const aRatio=originalA.naturalWidth/originalA.naturalHeight,bRatio=originalB.naturalWidth/originalB.naturalHeight;
 const aspectWarning=Math.abs(Math.log(aRatio/bRatio))>.08;
 const indexed=cells.map((v,i)=>({i,avg:v/counts[i]})).sort((a,b)=>b.avg-a.avg);
 const label=(cell)=>{
  const x=cell.i%GRID,y=Math.floor(cell.i/GRID);
  return (y<GRID/3?'上':y>=GRID*2/3?'下':'中')+(x<GRID/3?'左':x>=GRID*2/3?'右':'央');
 };
 const areas=[...new Set(indexed.slice(0,4).map(label))].slice(0,3);
 return {changedPercent:Math.round(changed/valid*100),meanDifference:Math.round(sum/valid*10)/10,areas,heatmap:c.toDataURL('image/png'),aspectWarning};
}
async function analyze(oldBlob,newBlob){
 const [oldIm,newIm]=await Promise.all([load(oldBlob),load(newBlob)]);
 const old=sample(oldIm),latest=sample(newIm),first=complexity(old),second=complexity(latest);
 return {change:compare(old,latest,oldIm,newIm),density:{
  previous:Math.round(first.amount*10)/10,
  current:Math.round(second.amount*10)/10,
  // Concentration of local lightness boundaries, not actual brushstroke count.
  hotCells:second.cells.filter(v=>v>second.amount*1.35).length,
  peak:Math.round(Math.max(...second.cells)*10)/10
 }};
}
g.ElabImageInstruments=Object.freeze({analyze});
})(window);