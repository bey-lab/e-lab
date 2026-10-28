/* E-lab 作品管理室 データ層 v0.2 (test branch)
   v0.1 キーには一切書き込まない。端末内保存であり、クラウド同期ではない。
   UI接続前の独立したモジュール。 */
(function(global){
'use strict';
const TEST_MODE=new URLSearchParams(global.location?.search||'').get('mode')==='test';
const KEY=TEST_MODE?'elab_works_v2_sandbox':'elab_works_v2';
const SCHEMA='E-lab-works-v2';
const STATES=['制作中','完成','凍結','ボツ'];
const PHASES=['ラフ','線画','着彩','仕上げ'];
const safeId=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
  ?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
const assert=(v,message)=>{if(!v)throw new Error(message)};
const clone=v=>JSON.parse(JSON.stringify(v));
function validateEvent(e){
 assert(e&&typeof e==='object'&&typeof e.type==='string'&&Number.isFinite(e.t),'観測イベントが不正です');
 if(e.type==='score')assert(Number.isInteger(e.value)&&e.value>=1&&e.value<=10,'気分値が不正です');
 if(e.type==='status')assert(STATES.includes(e.value),'作品状態が不正です');
 if(e.type==='phase')assert(PHASES.includes(e.value),'工程が不正です');
 if(e.type==='social'){
  assert(['X','pixiv','Instagram','Bluesky','その他'].includes(e.platform),'SNS名が不正です');
  assert(typeof e.postUrl==='string'&&e.postUrl.length<=500,'投稿URLが不正です');
  assert(typeof e.note==='string'&&e.note.length<=300,'投稿メモが不正です');
  for(const key of ['views','likes','reposts','replies','bookmarks']){
   assert(e[key]===null||(Number.isSafeInteger(e[key])&&e[key]>=0&&e[key]<=1e12),'SNSの観測値が不正です');
  }
 }
}
function validateWork(w){
 assert(w&&typeof w==='object'&&typeof w.id==='string'&&w.id.length>0,'作品IDがありません');
 assert(typeof w.title==='string'&&w.title.length<=300,'作品名が不正です');
 assert(STATES.includes(w.status),'作品状態が不正です');
 assert(Number.isFinite(w.createdAt),'作成日時が不正です');
 assert(Array.isArray(w.events)&&w.events.length<=100000,'イベント一覧が不正です');
 w.events.forEach(validateEvent);
}
function validateDB(db){
 assert(db&&db.schema===SCHEMA&&Array.isArray(db.works),'作品データの形式が違います');
 const ids=new Set();
 for(const w of db.works){validateWork(w);assert(!ids.has(w.id),'作品IDが重複しています');ids.add(w.id)}
 if(db.challenges!==undefined){
 assert(Array.isArray(db.challenges)&&db.challenges.length<=20000,'課題一覧が不正です');
 const taskIds=new Set();
 for(const task of db.challenges){
  assert(task&&typeof task.id==='string'&&task.id.length>0&&!taskIds.has(task.id),'課題IDが不正です');
  assert(typeof task.text==='string'&&task.text.trim().length>0&&task.text.length<=500,'課題の本文が不正です');
  assert(['active','archived'].includes(task.state),'課題状態が不正です');
  assert(typeof task.workId==='string'&&Number.isFinite(task.createdAt)&&Number.isFinite(task.updatedAt),'課題の記録が不正です');
  taskIds.add(task.id);
 }
}
 return db;
}
function empty(){return {schema:SCHEMA,works:[],challenges:[],updatedAt:Date.now()}}
function read(){
 const raw=localStorage.getItem(KEY);
 return raw?validateDB(JSON.parse(raw)):empty();
}
function commit(db){
 validateDB(db);
 const next=clone(db);next.updatedAt=Date.now();
 // setItem が失敗したら例外を返し、保存済みとは通知しない。
 localStorage.setItem(KEY,JSON.stringify(next));
 return next;
}
function change(mutator){const db=read();const result=mutator(db);commit(db);return result}
function create(title){
 const t=String(title||'').trim();
 assert(t.length>0&&t.length<=300,'作品名を入力してください');
 const t0=Date.now();
 const work={id:safeId(),title:t,status:'制作中',createdAt:t0,events:[{type:'status',value:'制作中',t:t0}]};
 change(db=>{db.works.push(work)});
 return clone(work);
}
function get(id){return clone(read().works.find(w=>w.id===id)||null)}
function list(){return clone(read().works)}
function rename(id,title){
 const t=String(title||'').trim();
 assert(t&&t.length<=300,'作品名が不正です');
 change(db=>{const w=db.works.find(w=>w.id===id);assert(w,'作品が見つかりません');w.title=t});
}
function observe(id,type,extras={}){
 assert(typeof type==='string'&&type.length>0,'イベント名が必要です');
 assert(type!=='status','状態変更には setStatus を使用してください');
 const evt={type,t:Date.now(),...clone(extras)};
 evt.type=type;evt.t=Date.now();
 validateEvent(evt);
 change(db=>{const w=db.works.find(w=>w.id===id);assert(w,'作品が見つかりません');w.events.push(evt)});
 return clone(evt);
}
function setStatus(id,status){
 assert(STATES.includes(status),'作品状態が不正です');
 change(db=>{const w=db.works.find(w=>w.id===id);assert(w,'作品が見つかりません');if(w.status===status)return;w.status=status;w.events.push({type:'status',value:status,t:Date.now()})});
}
function remove(id){
 change(db=>{const i=db.works.findIndex(w=>w.id===id);assert(i>=0,'作品が見つかりません');db.works.splice(i,1)});
}
function listChallenges(){return clone(read().challenges||[]).sort((a,b)=>b.updatedAt-a.updatedAt)}
function addChallenge(text,workId=''){
 const content=String(text||'').trim();assert(content.length>0&&content.length<=500,'課題を500文字以内で入力してください');
 const timestamp=Date.now(),task={id:safeId(),text:content,state:'active',workId:String(workId||''),createdAt:timestamp,updatedAt:timestamp};
 change(db=>{db.challenges??=[];db.challenges.push(task)});return clone(task);
}
function editChallenge(id,text){
 const content=String(text||'').trim();assert(content.length>0&&content.length<=500,'課題を500文字以内で入力してください');
 change(db=>{const task=(db.challenges||[]).find(x=>x.id===id);assert(task,'課題が見つかりません');task.text=content;task.updatedAt=Date.now()});
}
function setChallengeState(id,state){
 assert(['active','archived'].includes(state),'課題状態が不正です');
 change(db=>{const task=(db.challenges||[]).find(x=>x.id===id);assert(task,'課題が見つかりません');task.state=state;task.updatedAt=Date.now()});
}
function deleteChallenge(id){
 change(db=>{db.challenges??=[];const n=db.challenges.findIndex(x=>x.id===id);assert(n>=0,'課題が見つかりません');db.challenges.splice(n,1)});
}
function exportWork(id){
 const w=get(id);assert(w,'作品が見つかりません');
 return JSON.stringify({schema:SCHEMA,kind:'single-work',exportedAt:new Date().toISOString(),work:w},null,2);
}
function exportAll(){
 return JSON.stringify({schema:SCHEMA,kind:'all-works',exportedAt:new Date().toISOString(),data:read()},null,2);
}
function importWork(json,{replace=false}={}){
 const doc=typeof json==='string'?JSON.parse(json):clone(json);
 assert(doc&&doc.schema===SCHEMA&&doc.kind==='single-work','作品バックアップ形式が違います');
 validateWork(doc.work);
 change(db=>{
 const i=db.works.findIndex(w=>w.id===doc.work.id);
 if(i>=0){assert(replace,'同じIDの作品があります。既存記録を保護するため読み込みを中止しました');db.works[i]=clone(doc.work)}
 else db.works.push(clone(doc.work));
 });
 return doc.work.id;
}
function importAll(json,{replace=false}={}){
 const doc=typeof json==='string'?JSON.parse(json):clone(json);
 assert(doc&&doc.schema===SCHEMA&&doc.kind==='all-works','全作品バックアップ形式が違います');
 validateDB(doc.data);
 assert(replace,'全作品の置換は明示的な確認が必要です');
 return commit(doc.data);
}
global.ElabWorksStore=Object.freeze({KEY,SCHEMA,STATES,PHASES,read,create,get,list,rename,observe,setStatus,remove,exportWork,exportAll,importWork,importAll,validateBackup:validateDB,listChallenges,addChallenge,editChallenge,setChallengeState,deleteChallenge});
})(typeof window!=='undefined'?window:globalThis);
