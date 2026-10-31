/* E-lab 診断エンジン v1：読み取り専用。localStorage.setItem / delete は行わない */
(function(g){'use strict';
const mode=new URLSearchParams(location.search).get('mode')==='test'?'test':'normal';
const keys={works:mode==='test'?'elab_works_v2_sandbox':'elab_works_v2',tree:mode==='test'?'elab_knowledge_tree_v1_test':'elab_knowledge_tree_v1'};
const imageDb=mode==='test'?'elab_images_v03_sandbox':'elab_images_v03';
const issues=[],summary=[],snapshot={mode,at:new Date().toISOString(),locationContext:location.pathname,works:[],images:[],knowledge:null,checks:[],issues};
const check=(scope,status,message,detail='')=>{snapshot.checks.push({scope,status,message,detail});if(status==='error'||status==='warning')issues.push({scope,status,message,detail})};
function safeRead(key,scope){
 try{const raw=localStorage.getItem(key);if(raw===null)return{exists:false,bytes:0,data:null};
  return{exists:true,bytes:new Blob([raw]).size,data:JSON.parse(raw)}
 }catch(e){check(scope,'error','保存データの読み取り・解析失敗',String(e));return{exists:true,error:String(e)}}
}
function inspectWorks(){
 const r=safeRead(keys.works,'works');
 if(r.error)return;
 if(!r.exists){check('works','warning','作品データのキーが存在しません。未使用か、保存領域の違いかもしれません。');return}
 const data=r.data;
 if(!data||data.schema!=='E-lab-works-v2'||!Array.isArray(data.works)){check('works','error','作品データ形式が想定と異なります');return}
 snapshot.metadata={schema:data.schema,bytes:r.bytes,updatedAt:data.updatedAt,challenges:data.challenges?.length??null,inspirationPresent:!!data.inspiration};
 const ids=new Set();
 for(const w of data.works){
  if(!w||typeof w.id!=='string'||!Array.isArray(w.events)){check('works','error','不正な作品レコードを検出');continue}
  if(ids.has(w.id))check('works','error','作品ID重複',w.id);
  ids.add(w.id);
  let previous=-Infinity,invalid=0,eventsByType={},completed=w.status==='完成';
  for(const e of w.events){
   if(!e||!Number.isFinite(e.t)||typeof e.type!=='string'){invalid++;continue}
   eventsByType[e.type]=(eventsByType[e.type]||0)+1;
   if(e.t<previous)check(w.id,'warning','イベントの時刻順が逆転しています');
   previous=e.t;
   if(e.type==='status'&&e.value==='完成')completed=true;
  }
  if(invalid)check(w.id,'error','不正なイベントを検出',String(invalid)+'件');
  snapshot.works.push({id:w.id,title:w.title||'',status:w.status,createdAt:w.createdAt,eventCount:w.events.length,eventsByType,completed,invalidEvents:invalid,events:w.events.map(e=>({type:e.type,t:e.t,value:e.value,phase:e.phase,platform:e.platform}))});
 }
 check('works','ok','作品データを読み取りました',snapshot.works.length+'作品');
}
async function inspectImages(){
 if(!g.indexedDB){check('images','error','IndexedDBにアクセスできません');return}
 if(typeof indexedDB.databases==='function'){
  try{const dbs=await indexedDB.databases();if(!dbs.some(x=>x.name===imageDb)){check('images','warning','画像データベースが存在しません');return}}catch(e){check('images','warning','DB一覧の取得不可',String(e))}
 }
 await new Promise(resolve=>{
  let settled=false,req,db;
  const done=()=>{if(settled)return;settled=true;if(db)db.close();resolve()};
  try{
   req=indexedDB.open(imageDb);
   req.onupgradeneeded=()=>{req.transaction.abort();check('images','warning','未作成の画像DB。診断時の新規作成を中止しました');done()};
   req.onerror=()=>{check('images','error','画像DBを開けません',String(req.error||'unknown'));done()};
   req.onsuccess=()=>{
    db=req.result;
    if(!db.objectStoreNames.contains('snapshots')){check('images','error','画像の保存テーブルが存在しません');done();return}
    let tx;
    try{
     tx=db.transaction('snapshots','readonly');
     const cursor=tx.objectStore('snapshots').openCursor();
     cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;const v=c.value;
      snapshot.images.push({id:v.id,workId:v.workId,bytes:v.bytes,createdAt:v.createdAt,phase:v.phase,blobPresent:v.blob instanceof Blob,actualBytes:v.blob instanceof Blob?v.blob.size:null});
      c.continue()
     };
     cursor.onerror=()=>check('images','error','画像レコード走査失敗',String(cursor.error||'unknown'));
     tx.oncomplete=done;tx.onabort=()=>{check('images','error','画像DB読み取り中断');done()};tx.onerror=()=>check('images','error','画像DB読み取り失敗');
    }catch(e){check('images','error','画像テーブルの検査失敗',String(e));done()}
   };
  }catch(e){check('images','error','IndexedDB例外',String(e));done()}
 });
 check('images','ok','画像レコードの検査を終了',snapshot.images.length+'件');
}
function inspectKnowledge(){
 const r=safeRead(keys.tree,'knowledge');
 if(r.error)return;
 if(!r.exists){check('knowledge','ok','知識の樹は未使用です');return}
 if(!r.data||r.data.schema!=='elab-knowledge-v1'||!Array.isArray(r.data.unlocked)){check('knowledge','error','解放記録の形式が異なります');return}
 snapshot.knowledge={unlocked:r.data.unlocked,bytes:r.bytes};
 if(new Set(r.data.unlocked).size!==r.data.unlocked.length)check('knowledge','warning','研究解放IDの重複');
 check('knowledge','ok','研究解放データを読み取りました',r.data.unlocked.length+'件');
}
function crossCheck(){
 const ids=new Set(snapshot.works.map(w=>w.id)),imageIds=new Set(),count={};
 for(const im of snapshot.images){
  if(imageIds.has(im.id))check('images','error','画像IDの重複',im.id);
  imageIds.add(im.id);
  count[im.workId]=(count[im.workId]||0)+1;
  if(!ids.has(im.workId))check('images','warning','作品が見つからない画像',String(im.id));
  if(!im.blobPresent)check('images','error','画像本体Blobが見つかりません',String(im.id));
  else if(Number.isFinite(im.bytes)&&im.bytes!==im.actualBytes)check('images','warning','画像サイズ情報と実体が不一致',String(im.id));
 }
 for(const w of snapshot.works)w.imageCount=count[w.id]||0;
}
function report(includeEventDetail=false){
 const copy=JSON.parse(JSON.stringify(snapshot));
 if(!includeEventDetail)for(const w of copy.works)delete w.events;
 return JSON.stringify({format:'ELAB_DIAGNOSTIC_V1',...copy},null,2)
}
async function scan(){
 inspectWorks();inspectKnowledge();await inspectImages();crossCheck();
 snapshot.healthy=issues.some(i=>i.status==='error')?'error':issues.length?'warning':'ok';
 return snapshot;
}
g.ElabDiagnostics={scan,report,mode,keys,imageDb};
})(window);