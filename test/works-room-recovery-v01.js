
(function(){
'use strict';
const button=document.getElementById('runRecoveryDiagnostics');
const output=document.getElementById('recoveryDiagnosticResults');
if(!button||!output)return;
function inspectLocal(key){
 try{
  const raw=localStorage.getItem(key);
  if(raw===null)return '未作成（キーなし）';
  const data=JSON.parse(raw);
  const works=Array.isArray(data.works)?data.works:null;
  if(!works)return '保存あり／解析不能（形式を確認）';
  const names=works.slice(0,15).map(w=>String(w.title||'名称なし')).join('、');
  return works.length+'作品／'+raw.length+'文字'+(names?'\n   作品名: '+names:'');
 }catch(e){return '読み取りエラー: '+e.name+' '+e.message}
}
async function inspectImages(name){
 if(!('indexedDB' in window))return 'IndexedDB非対応';
 if(typeof indexedDB.databases==='function'){
  try{const names=(await indexedDB.databases()).map(x=>x.name);if(!names.includes(name))return '未作成（DBなし）'}catch(e){}
 }
 return new Promise(resolve=>{
  let done=false,req;
  const finish=s=>{if(done)return;done=true;resolve(s)};
  try{
   req=indexedDB.open(name);
   req.onupgradeneeded=()=>{
    // Unknown DB must not be created by diagnosis.
    req.transaction.abort();
    finish('既存DBなし（新規作成を中止）');
   };
   req.onerror=()=>finish('読み取りエラー: '+(req.error?.name||'unknown'));
   req.onsuccess=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('snapshots')){db.close();finish('保存DBあり／画像テーブルなし');return}
    try{
     const tx=db.transaction('snapshots','readonly');
     const counter=tx.objectStore('snapshots').count();
     counter.onsuccess=()=>finish(counter.result+'枚');
     counter.onerror=()=>finish('画像件数の確認に失敗');
     tx.oncomplete=()=>db.close();
     tx.onerror=()=>{db.close();finish('画像テーブルの読み取りエラー')};
    }catch(e){db.close();finish('画像の読み取りエラー: '+e.message)}
   };
  }catch(e){finish('画像DBを開けません: '+e.name)}
 });
}
button.addEventListener('click',async()=>{
 button.disabled=true;output.textContent='保存領域を読み取っています…';
 try{
  const lines=['E-lab 保存診断（読み取り専用）',
   '日時: '+new Date().toLocaleString('ja-JP'),
   '実行環境: '+(window.matchMedia('(display-mode:standalone)').matches?'ホーム画面アプリ':'ブラウザ表示'),
   '画面モード: '+(new URLSearchParams(location.search).get('mode')==='test'?'テスト':'通常'),
   '',
   '通常作品: '+inspectLocal('elab_works_v2'),
   'テスト作品: '+inspectLocal('elab_works_v2_sandbox'),
   '旧版v0.1: '+(localStorage.getItem('elab_prototype_v1')===null?'キーなし':'保存データあり'),
   '',
   '通常画像: '+await inspectImages('elab_images_v03'),
   'テスト画像: '+await inspectImages('elab_images_v03_sandbox'),
   '',
   '※確認のみ。削除・修復は実施していません。'];
  output.textContent=lines.join('\n');
 }catch(e){output.textContent='診断に失敗: '+e.name+' '+e.message}
 finally{button.disabled=false}
});
})();
