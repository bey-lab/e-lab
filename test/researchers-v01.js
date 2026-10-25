/* E-lab 研究員衣装管理 v0.2
 * Each costume is an independent transparent PNG stored in IndexedDB.
 * Future costume slots are supported. This does not touch artwork records. */
(function(g){'use strict';
const DB='elab_researchers_v01',STORE='assets',CHOICE='elab_researcher_variants_v02';
const ROLES=['kokoro','ritsu'];
function open(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error||Error('衣装保管庫を開けません'))})}
async function tx(mode,fn){const db=await open();return new Promise((ok,no)=>{let out;const tr=db.transaction(STORE,mode);try{const req=fn(tr.objectStore(STORE));if(req)req.onsuccess=()=>out=req.result}catch(e){db.close();no(e);return}tr.oncomplete=()=>{db.close();ok(out)};tr.onerror=()=>{db.close();no(tr.error||Error('保存に失敗しました'))};tr.onabort=()=>{db.close();no(tr.error||Error('保存を中断しました'))}})}
const key=(role,variant)=>'sprite-'+role+'-'+variant;
function valid(role,variant){if(!ROLES.includes(role)||!Number.isInteger(variant)||variant<0||variant>99)throw Error('衣装番号が不正です')}
function choices(){try{const j=JSON.parse(localStorage.getItem(CHOICE)||'{}');return {kokoro:Number.isInteger(j.kokoro)?j.kokoro:0,ritsu:Number.isInteger(j.ritsu)?j.ritsu:0}}catch{return {kokoro:0,ritsu:0}}}
function choose(role,variant){valid(role,variant);const j=choices();j[role]=variant;localStorage.setItem(CHOICE,JSON.stringify(j))}
const get=(role,variant)=>{valid(role,variant);return tx('readonly',s=>s.get(key(role,variant)))};
function checkImage(f){if(!f||!f.type.startsWith('image/'))throw Error('画像を選んでください');if(f.size>12*1024*1024)throw Error('画像は12MB以下にしてください')}
async function save(role,variant,file){valid(role,variant);checkImage(file);await tx('readwrite',s=>s.put(file,key(role,variant)))}
function parseName(name){const m=/^(kokoro|ritsu)[-_]([a-z]|[0-9]+)\.(png|webp|jpe?g)$/i.exec(name||'');if(!m)return null;let variant=/^[a-z]$/i.test(m[2])?m[2].toLowerCase().charCodeAt(0)-97:Number(m[2]);return variant<=99?{role:m[1].toLowerCase(),variant}:null}
async function saveBatch(files){const entries=[];for(const file of files){const parsed=parseName(file.name);if(!parsed)continue;checkImage(file);entries.push({...parsed,file})}if(!entries.length)throw Error('kokoro-a.png、ritsu-b.png などの名前の画像を選んでください');const db=await open();await new Promise((ok,no)=>{const tr=db.transaction(STORE,'readwrite'),s=tr.objectStore(STORE);for(const e of entries)s.put(e.file,key(e.role,e.variant));tr.oncomplete=ok;tr.onerror=()=>no(tr.error);tr.onabort=()=>no(tr.error)});db.close();return entries.length}
async function variants(role){if(!ROLES.includes(role))throw Error('研究員が不正です');const db=await open();return new Promise((ok,no)=>{const tr=db.transaction(STORE,'readonly'),req=tr.objectStore(STORE).getAllKeys();req.onsuccess=()=>{const prefix='sprite-'+role+'-';ok(req.result.filter(k=>typeof k==='string'&&k.startsWith(prefix)).map(k=>Number(k.slice(prefix.length))).filter(Number.isInteger).sort((a,b)=>a-b))};req.onerror=()=>no(req.error);tr.oncomplete=()=>db.close()})}
g.ElabResearchers=Object.freeze({get,save,saveBatch,variants,choices,choose,parseName});
})(window);