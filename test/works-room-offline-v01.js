
(function(){
 'use strict';
 const status=document.getElementById('offlineStatus');
 const button=document.getElementById('offlineRetry');
 if(!('serviceWorker' in navigator)){status.textContent='⚠ このブラウザはオフライン起動に対応していません';button.hidden=true;return}
 let registered=null;
 function display(detail){
  if(detail?.ready)status.textContent='✅ オフライン準備完了（'+detail.files+'/'+detail.total+'ファイル）。次回から通信なしで起動できます。'+(detail.zipReady?'バックアップZIPも利用可能。':'※ZIPの書き出し・復元には通信が必要な場合があります。');
  else if(detail)status.textContent='📡 オフライン用ファイルを準備中（'+detail.files+'/'+detail.total+'）。オンラインで再読み込みしてください。';
 }
 navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='ELAB_OFFLINE_STATUS')display(e.data)});
 async function verify(){
  try{
   const reg=registered||await navigator.serviceWorker.getRegistration('./');registered=reg;
   if(!reg){status.textContent='📡 オフライン機能を登録しています…';return}
   if(reg.installing){status.textContent='📡 オフラインのデータを保存中です…';return}
   if(!reg.active){status.textContent='📡 準備中です。オンラインで開き直してください。';return}
   status.textContent='📡 保存済みのファイルを確認しています…';
   reg.active.postMessage({type:'ELAB_OFFLINE_STATUS'});
  }catch(e){status.textContent='⚠ オフライン準備の確認に失敗：'+e.message}
 }
 async function setup(){
  try{
   status.textContent='📡 オフライン用データを保存しています…';
   registered=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
   if(registered.installing)registered.installing.addEventListener('statechange',()=>{if(registered.installing?.state==='activated'||registered.active)verify()});
   navigator.serviceWorker.addEventListener('controllerchange',verify);
   await navigator.serviceWorker.ready;
   await verify();
  }catch(e){status.textContent='⚠ オフライン準備に失敗：'+e.message+'。ネット接続を確認して再読み込みしてください。'}
 }
 button.onclick=()=>{status.textContent='📡 確認しています…';if(registered)registered.update().then(verify).catch(e=>{status.textContent='⚠ '+e.message});else setup()};
 setup();
})();
