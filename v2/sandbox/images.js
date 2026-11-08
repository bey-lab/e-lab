/* E-lab V2 snapshots. Independent from the time ledger. */
(function(g){"use strict";
const DB="elab-v2-sandbox-images-20261108",STORE="snapshots";
function open(){return new Promise((resolve,reject)=>{if(!g.indexedDB)return reject(Error("このブラウザでは画像保管庫を利用できません"));const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const s=q.result.createObjectStore(STORE,{keyPath:"id"});s.createIndex("projectId","projectId",{unique:false})};q.onerror=()=>reject(q.error||Error("画像保管庫を開けません"));q.onsuccess=()=>resolve(q.result)})}
async function transact(mode,act){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;try{result=act(store)}catch(e){db.close();reject(e);return}tx.oncomplete=()=>{db.close();resolve(result?.result)};tx.onerror=()=>{db.close();reject(tx.error||Error("画像の保存に失敗しました"))};tx.onabort=()=>{db.close();reject(tx.error||Error("画像の保存を中断しました"))}})}
const all=()=>transact("readonly",s=>s.getAll());
const add=record=>transact("readwrite",s=>s.add(record));
const remove=id=>transact("readwrite",s=>s.delete(id));
const removeProject=projectId=>transact("readwrite",s=>{const req=s.index("projectId").openCursor(IDBKeyRange.only(projectId));req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue()}};return req});
const replaceAll=records=>transact("readwrite",s=>{s.clear();for(const x of records)s.put(x)});
async function imageBlob(file){if(!file.type.startsWith("image/"))throw Error("画像ファイルを選択してください");const bitmap=await createImageBitmap(file).catch(()=>null);if(!bitmap)throw Error("画像を読み込めません");const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("画像の変換に失敗しました")),"image/jpeg",0.82))}
g.ElabV2Images=Object.freeze({all,add,remove,removeProject,replaceAll,imageBlob});
})(window);
