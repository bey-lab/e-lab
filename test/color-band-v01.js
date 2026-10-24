/* E-lab 色帯観測装置 v0.1
   概算の画素割合。絵の良し悪しは判定しない。元画像は変更せず、縮小した画素だけを調べる。 */
(function(global){'use strict';
const GROUPS=[
 {id:'red',name:'赤系',color:'#dc6475'},
 {id:'orange',name:'橙系',color:'#e3a065'},
 {id:'yellow',name:'黄系',color:'#e4d06f'},
 {id:'green',name:'緑系',color:'#77b789'},
 {id:'cyan',name:'シアン系',color:'#63bcc6'},
 {id:'blue',name:'青系',color:'#6c90df'},
 {id:'purple',name:'紫系',color:'#a78add'},
 {id:'pink',name:'桃系',color:'#d989b9'},
 {id:'white',name:'白系',color:'#e7e9ec'},
 {id:'gray',name:'灰系',color:'#8d96aa'},
 {id:'black',name:'黒系',color:'#34394d'}
];
function group(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,v=max/255;
 const sat=max?delta/max:0;
 if(v<0.17)return 'black';
 if(sat<0.13){return v>0.88?'white':v<0.27?'black':'gray'}
 let h=0;
 if(delta!==0){
  if(max===r)h=((g-b)/delta)%6;
  else if(max===g)h=(b-r)/delta+2;
  else h=(r-g)/delta+4;
  h=(h*60+360)%360;
 }
 if(h<12||h>=348)return 'red';
 if(h<43)return 'orange';
 if(h<72)return 'yellow';
 if(h<164)return 'green';
 if(h<198)return 'cyan';
 if(h<253)return 'blue';
 if(h<292)return 'purple';
 return 'pink';
}
async function analyze(blob){
 if(!blob||!blob.type.startsWith('image/'))throw Error('画像を解析できません');
 const url=URL.createObjectURL(blob),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('画像データが読み込めません'));img.src=url});
  const w=img.naturalWidth,h=img.naturalHeight;
  if(!w||!h)throw Error('画像の大きさが不正です');
  const scale=Math.min(1,160/Math.max(w,h));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('画像解析用の描画装置を利用できません');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const counts=Object.fromEntries(GROUPS.map(g=>[g.id,0]));let total=0;
  for(let i=0;i<pixels.length;i+=4){
   if(pixels[i+3]<128)continue; // 透明部分は数えない
   counts[group(pixels[i],pixels[i+1],pixels[i+2])]++;total++;
  }
  if(!total)return {total:0,segments:[],message:'透明な部分だけが観測されました。'};
  const all=GROUPS.map(g=>({...g,count:counts[g.id],ratio:counts[g.id]/total*100})).filter(g=>g.count).sort((a,b)=>b.count-a.count);
  const visible=all.slice(0,5).map(g=>({name:g.name,color:g.color,ratio:g.ratio}));
  const rest=all.slice(5).reduce((sum,g)=>sum+g.count,0);
  if(rest)visible.push({name:'その他',color:'#65718c',ratio:rest/total*100});
  const top=all[0];
  const msg=top.ratio>=50?'かなり'+top.name+'が多いようです。':top.ratio>=30?top.name+'が多めに見つかりました。':'いろいろな色が見つかりました。';
  return {total,segments:visible,message:msg,top:top.name,sourceSize:{width:w,height:h},sampleSize:{width:canvas.width,height:canvas.height}};
 }finally{URL.revokeObjectURL(url)}
}
global.ElabColorBand=Object.freeze({analyze});
})(window);