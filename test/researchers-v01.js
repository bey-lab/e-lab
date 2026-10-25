/* E-lab 研究員配属室 v0.1 — conceptual sheet uploaded by the user, stored on this device. */
(function(g){'use strict';
const DB='elab_researchers_v01',STORE='assets',CHOICE='elab_researcher_variants_v01';
const REGIONS=[{x:20,y:237,w:215,h:667},{x:242,y:237,w:215,h:667},{x:469,y:237,w:224,h:667},{x:718,y:237,w:223,h:667},{x:949,y:237,w:223,h:667},{x:1185,y:237,w:245,h:667}];
function open(){return new Promise((res,rej)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function transact(mode,fn){const db=await open();return new Promise((resolve,reject)=>{let value;const tx=db.transaction(STORE,mode);try{const req=fn(tx.objectStore(STORE));if(req)req.onsuccess=()=>{value=req.result}}catch(e){db.close();reject(e);return}tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)}})}
const image=()=>transact('readonly',s=>s.get('sheet'));
async function save(file){if(!file||!file.type.startsWith('image/'))throw Error('画像を選択してください');if(file.size>20*1024*1024)throw Error('20MB以下の画像を選択してください');await transact('readwrite',s=>s.put(file,'sheet'))}
function choices(){try{const v=JSON.parse(localStorage.getItem(CHOICE)||'{}');return {kokoro:Math.max(0,Math.min(2,Number(v.kokoro)||0)),ritsu:Math.max(0,Math.min(2,Number(v.ritsu)||0))}}catch{return {kokoro:0,ritsu:0}}}
function choose(role,n){const c=choices();if(!(role in c)||![0,1,2].includes(n))throw Error('設定が不正です');c[role]=n;localStorage.setItem(CHOICE,JSON.stringify(c))}
function blobImage(blob){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('設定画を読み込めません'))};im.src=u})}
async function portrait(blob,role,n){
 const im=await blobImage(blob),r=REGIONS[(role==='ritsu'?3:0)+n], sx=im.naturalWidth/1448,sy=im.naturalHeight/1086;
 const c=document.createElement('canvas');c.width=225;c.height=320;const ctx=c.getContext('2d');if(!ctx)throw Error('画像を描画できません');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 ctx.drawImage(im,r.x*sx,r.y*sy,r.w*sx,r.h*sy,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.87);
}
g.ElabResearchers=Object.freeze({save,image,choices,choose,portrait});
})(window);