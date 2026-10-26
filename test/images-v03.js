/* E-lab image storage v0.3 — IndexedDB separate from works metadata.
Images stay on this device. JSON backups from v0.2 DO NOT contain image files. */
(function(g){'use strict';
const TEST_MODE=new URLSearchParams(g.location?.search||'').get('mode')==='test';
const DB=TEST_MODE?'elab_images_v03_sandbox':'elab_images_v03',TABLE='snapshots';
function connect(){return new Promise((resolve,reject)=>{if(!g.indexedDB)return reject(Error('このブラウザでは画像保存が使用できません'));
const req=indexedDB.open(DB,1);
req.onupgradeneeded=()=>{let db=req.result;const s=db.createObjectStore(TABLE,{keyPath:'id'});s.createIndex('workId','workId',{unique:false})};
req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('画像データベースを開けません'))})}
async function query(mode,worker){const db=await connect();return new Promise((resolve,reject)=>{const tx=db.transaction(TABLE,mode),store=tx.objectStore(TABLE);let result;try{result=worker(store)}catch(e){db.close();reject(e);return}
tx.oncomplete=()=>{db.close();resolve(result&&result.result!==undefined?result.result:result)};
tx.onerror=()=>{db.close();reject(tx.error||Error('画像を保存できません'))};
tx.onabort=()=>{db.close();reject(tx.error||Error('画像保存が中断されました'))}})}
const uuid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
function dimensions(blob){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve({width:img.naturalWidth,height:img.naturalHeight})};img.onerror=()=>{URL.revokeObjectURL(u);reject(Error('画像を読み取れません'))};img.src=u})}
async function add(workId,file,phase,score){if(!workId||!file||!file.type.startsWith('image/'))throw Error('画像ファイルを選んでください');
if(file.size>25*1024*1024)throw Error('画像は25MB以下にしてください');
const size=await dimensions(file);
const record={id:uuid(),workId,createdAt:Date.now(),phase,score:score??null,name:file.name||'image',type:file.type,bytes:file.size,...size,blob:file};
await query('readwrite',s=>s.put(record));return {...record,blob:undefined}}
async function list(workId){const db=await connect();return new Promise((resolve,reject)=>{const tx=db.transaction(TABLE,'readonly'),s=tx.objectStore(TABLE).index('workId'),req=s.getAll(IDBKeyRange.only(workId));req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.createdAt-a.createdAt));req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()})}
async function remove(id){return query('readwrite',s=>s.delete(id))}
async function get(id){return query('readonly',s=>s.get(id))}
g.ElabImageStore=Object.freeze({add,list,remove,get});
})(window);