
(()=>{'use strict';
const $=id=>document.getElementById(id), S=window.ElabWorksStore, I=window.ElabImageStore;
const isTest=window.ELAB_IS_TEST;
$('knowledgeTreeLink').href='./knowledge-tree-v01.html?mode='+(isTest?'test':'normal');
$('diagnosticsLink').href='./system-diagnostics-v01.html?mode='+(isTest?'test':'normal');
$('modeBadge').textContent=isTest?'🧪 テストモード':'通常モード';
$('switchMode').href=isTest?'?mode=normal':'?mode=test';
$('switchMode').textContent=isTest?'← 通常モードに戻る':'🧪 テストモードへ';
$('modeNotice').textContent=isTest?'🧪 テストモード：作品・制作時間・気分・画像は通常モードと完全に別保存。気兼ねなく画像を試せます。記録はこのブラウザ内に保存されます。':'通常モード：本番の作品・画像を記録します。練習で画像を試すなら右上の「🧪 テストモードへ」。どちらも旧v0.1とは独立保存です。';
if(!S){alert('保存モジュールが読み込めませんでした');return}
const phases=S.PHASES,R=window.ElabResearchers;
let pendingPause=null,pauseMoodScore=7;let chosen=null,phase='ラフ',moodComment=null,visibleEvents=10,imageRequest=0,imageUrls=[],colorRequest=0,instrumentRequest=0,completionTalk=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=t=>new Date(t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const fmt=ms=>{let n=Math.max(0,Math.floor(ms/1000));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
const evs=w=>w?.events||[];
const lastControl=w=>evs(w).filter(e=>['start','pause','resume','finish'].includes(e.type)).at(-1);
const running=w=>['start','resume'].includes(lastControl(w)?.type);
const started=w=>!!lastControl(w);
function elapsed(w){if(!w)return 0;let sum=0,from=null;for(const e of w.events){if(['start','resume'].includes(e.type))from=e.t;if(['pause','finish'].includes(e.type)&&from!==null){sum+=Math.max(0,e.t-from);from=null}}if(from!==null)sum+=Math.max(0,Date.now()-from);return sum}
function operate(task){try{task();render()}catch(err){alert('記録できませんでした。\n'+err.message)}}
function current(){return chosen?S.get(chosen):null}
function setPhaseFrom(w){phase=evs(w).filter(e=>e.type==='phase').at(-1)?.value||'ラフ'}
function select(id){dismissPauseMood();completionTalk=null;const prev=current();if(prev&&prev.id!==id&&running(prev))S.observe(prev.id,'pause',{reason:'作品切替'});chosen=id;setPhaseFrom(current());moodComment=null;visibleEvents=10;$('eventFilter').value='all';render();showImages(id)}
function emit(type,extra={}){S.observe(chosen,type,extra)}
function begin(){dismissPauseMood();operate(()=>{const w=current();if(!w||w.status!=='制作中')return;if(!started(w)){emit('start');emit('phase',{value:phase})}else if(!running(w)){emit('resume')}moodComment=null})}
function dismissPauseMood(){pendingPause=null;$('pauseMoodPrompt').classList.add('hidden')}
function showPauseMood(workId,pauseAt){pendingPause={workId,pauseAt};pauseMoodScore=7;updatePauseMood();$('pauseMoodPrompt').classList.remove('hidden');$('pauseMoodPrompt').scrollIntoView({behavior:'smooth',block:'nearest'})}
function updatePauseMood(){$('pauseMoodValue').textContent=pauseMoodScore+' / 10';[...$('pauseMoodChoices').children].forEach((b,i)=>b.classList.toggle('active',i+1===pauseMoodScore))}
function pause(){try{const w=current();if(!w||!running(w))return;emit('pause');const paused=current();const pauseEvent=evs(paused).filter(e=>e.type==='pause').at(-1);moodComment=null;render();if(pauseEvent)showPauseMood(paused.id,pauseEvent.t)}catch(err){alert('休憩を記録できませんでした。\n'+err.message)}}
function resume(){dismissPauseMood();operate(()=>{const w=current();if(!w||w.status!=='制作中')return;if(started(w)&&!running(w))emit('resume');moodComment=null})}
const completionLines=[
 ['所長ーー！ 完成おめでとうございますっ！ 今日も一枚、研究所の宝物が増えました！','制作完了を確認しました。記録も保存されています。……お疲れさまでした、所長。'],
 ['わあっ、完成です！ 所長、やりましたね！ じっくり眺めましょう！','今回の研究も一区切りですね。制作時間と観測結果は、次の作品にも役立つはずです。'],
 ['ぱーん！ おめでとうございます、所長！ 完成祝いですっ！','作品の完成を確認しました。……こうして形になったものを見るのは、いいですね。'],
 ['完成ーーっ！ 所長、今日は盛大に拍手です！','一枚の作品として完成しましたね。記録した過程も、立派な研究成果です。']
];
function closeCompletion(){$('completionBackdrop').classList.add('hidden')}
$('completionClose').onclick=closeCompletion;
$('completionBackdrop').onclick=e=>{if(e.target===$('completionBackdrop'))closeCompletion()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('completionBackdrop').classList.contains('hidden'))closeCompletion()});
function celebrateCompletion(work){
 const pair=completionLines[Math.floor(Math.random()*completionLines.length)];
 completionTalk={id:work.id,kokoro:pair[0],ritsu:pair[1]};
 $('completionWork').textContent=work.title;
 $('completionStats').textContent='制作時間 '+fmt(elapsed(work))+' ／ 気分観測 '+evs(work).filter(e=>e.type==='score').length+'件';
 $('completionKokoro').textContent='☀️ こころ「'+pair[0]+'」';
 $('completionRitsu').textContent='📊 律「'+pair[1]+'」';
 $('completionBackdrop').classList.remove('hidden');
 $('completionClose').focus();
}
function changeStatus(status){operate(()=>{
 const w=current();if(!w||w.status===status)return;
 if(running(w))emit('pause',{reason:'状態変更'});
 S.setStatus(chosen,status);moodComment=null;
 if(status==='完成')celebrateCompletion(S.get(chosen));
 else completionTalk=null;
 refreshGallery();
})}
function clearImageUrls(){for(const url of imageUrls)URL.revokeObjectURL(url);imageUrls=[]}
async function showColor(image,workId){
 const token=++colorRequest;
 $('colorReportText').textContent='色を観測しています…';
 $('colorBar').replaceChildren();$('colorLegend').replaceChildren();$('colorTalk').textContent='';
 try{
  if(!window.ElabColorBand)throw Error('色帯解析モジュールが読み込まれていません');
  const result=await window.ElabColorBand.analyze(image.blob);
  if(token!==colorRequest||chosen!==workId)return;
  if(!result.total){$('colorReportText').textContent=result.message;return}
  $('colorReportText').textContent='主な使用色（概算）';
  for(const part of result.segments){
   const item=document.createElement('div');item.style.flex=String(part.ratio);item.style.background=part.color;item.title=part.name+' '+part.ratio.toFixed(1)+'%';
   $('colorBar').appendChild(item);
   const txt=document.createElement('span');txt.className='small';txt.textContent=part.name+' '+part.ratio.toFixed(1)+'%';
   $('colorLegend').appendChild(txt);
  }
  $('colorTalk').textContent='律「'+result.message+'」　こころ「色が見つかりましたねえ……！」';
 }catch(e){if(token!==colorRequest)return;$('colorReportText').textContent='解析できませんでした：'+e.message}
}
async function showInstruments(images,workId){
 const token=++instrumentRequest;
 const state=$('instrumentState'),copy=$('instrumentText'),content=$('instrumentContent');
 content.classList.add('hidden');state.textContent='観測待ち';
 if(images.length<2){copy.textContent='同じ作品に画像を2枚以上登録すると、直近2枚を比較します。';return}
 if(!window.ElabImageInstruments){copy.textContent='観測装置を読み込めませんでした。再読み込みしてください。';state.textContent='使用不可';return}
 state.textContent='画像を比較中';copy.textContent='直近2枚の変化を観測しています…';
 try{
  const old=images[1],latest=images[0],report=await ElabImageInstruments.analyze(old.blob,latest.blob);
  if(token!==instrumentRequest||chosen!==workId)return;
  $('differenceHeatmap').src=report.change.heatmap;
  $('differenceStats').textContent='変化した画素：約'+report.change.changedPercent+'％ ／ 平均色差 '+report.change.meanDifference+'（0〜255）\n変化が目立つ位置：'+report.change.areas.join('・');
  $('differenceStats').style.whiteSpace='pre-line';
  $('densityStats').textContent='明暗の境界量（概算）\n前：'+report.density.previous+' → 後：'+report.density.current+'\n密度が比較的高い区画：64区画中 '+report.density.hotCells+' 区画';
  $('densityStats').style.whiteSpace='pre-line';
  copy.textContent=stamp(old.createdAt)+' → '+stamp(latest.createdAt)+' を比較。'+(report.change.aspectWarning?' ※画像の縦横比が異なるため、差は参考値です。':'');
  content.classList.remove('hidden');state.textContent='観測済み';
 }catch(e){if(token!==instrumentRequest)return;copy.textContent='画像比較に失敗しました：'+e.message;state.textContent='観測失敗'}
}
async function showImages(workId){
 const token=++imageRequest;++colorRequest;++instrumentRequest;clearImageUrls();
 $('imageError').classList.add('hidden');$('imageCount').textContent='読み込み中';$('imageGallery').replaceChildren();$('latestImage').textContent='画像を確認しています…';
 try{
   if(!I)throw Error('画像管理モジュールが読み込まれていません');
   const images=await I.list(workId);if(token!==imageRequest||chosen!==workId)return;
   $('imageCount').textContent=images.length+'枚';
   $('latestImage').replaceChildren();
   if(!images.length){showInstruments([],workId);$('latestImage').textContent='まだ画像は届いていません。';$('colorReportText').textContent='画像が登録されると色を数えます。';$('colorBar').replaceChildren();$('colorLegend').replaceChildren();$('colorTalk').textContent='';return}
   const newest=images[0],head=document.createElement('div'),pic=document.createElement('img');
   pic.src=URL.createObjectURL(newest.blob);imageUrls.push(pic.src);pic.alt='最新観測画像';pic.style.cssText='width:100%;max-height:min(48vh,480px);object-fit:contain;border-radius:10px';
   head.textContent='最新の観測画像：'+newest.name+' / '+newest.width+'×'+newest.height+'px / '+stamp(newest.createdAt);showInstruments(images,workId);
   $('latestImage').append(head,pic);showColor(newest,workId);
   for(const im of images){
     const card=document.createElement('div');card.style.cssText='width:110px;min-width:110px;background:#2d3858;padding:6px;border-radius:9px;display:grid;gap:5px';
     const thumb=document.createElement('img');thumb.src=URL.createObjectURL(im.blob);imageUrls.push(thumb.src);thumb.style.cssText='width:100%;height:90px;object-fit:contain';thumb.alt=im.name;
     thumb.onclick=()=>{const newpic=$('latestImage').querySelector('img');if(newpic)newpic.src=thumb.src;showColor(im,workId);};
     const info=document.createElement('div');info.className='small';info.textContent=stamp(im.createdAt)+' '+(im.phase||'工程不明');
     const del=document.createElement('button');del.className='danger';del.textContent='削除';del.style.padding='6px';del.onclick=async()=>{if(!confirm('この画像を端末内の保存場所から削除しますか？ この操作は戻せません。'))return;try{await I.remove(im.id);await showImages(workId)}catch(e){alert('画像を削除できませんでした: '+e.message)}};
     card.append(thumb,info,del);$('imageGallery').append(card);
   }
 }catch(e){if(token!==imageRequest)return;$('imageCount').textContent='読み込み失敗';$('latestImage').textContent='画像を表示できません';$('imageError').textContent=e.message;$('imageError').classList.remove('hidden')}
}
$('imageInput').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||!chosen)return;
 const workId=chosen;const btn=$('imageInput').closest('label');btn.style.opacity='.45';
 try{
  const w=S.get(workId);if(!w)throw Error('作品がありません');
  const prevScore=w.events.filter(ev=>ev.type==='score').at(-1)?.value??null;
  const image=await I.add(workId,file,phase,prevScore);
  try{S.observe(workId,'image',{imageId:image.id,name:image.name,phase,score:prevScore})}
  catch(err){alert('画像は保存されましたが、観測履歴への記録が失敗しました。画像は削除せず保管しています。理由: '+err.message)}
  if(chosen===workId){render();await showImages(workId)}
  refreshGallery();
 }catch(err){$('imageError').textContent='画像保存エラー: '+err.message;$('imageError').classList.remove('hidden')}
 finally{btn.style.opacity='1'}
};
function download(name,json){const blob=new Blob([json],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2500)}
function fileRead(file,fn){if(!file)return;file.text().then(text=>operate(()=>fn(text))).catch(e=>alert('読み込みに失敗しました: '+e.message))}
let backupBusy=false;
const backupStatus=message=>{$('completeBackupStatus').textContent=message};
$('completeExport').onclick=async()=>{
 if(backupBusy)return;backupBusy=true;$('completeExport').disabled=true;
 try{
  backupStatus('作品と画像を集めています…');
  const result=await ElabCompleteBackup.exportAll(backupStatus);
  const url=URL.createObjectURL(result.blob),a=document.createElement('a');
  a.href=url;a.download=result.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
  backupStatus('バックアップを作成しました：'+result.workCount+'作品・'+result.imageCount+'画像。iPadの「ファイル」に保存されたことをご確認ください。');
 }catch(e){backupStatus('書き出し失敗：'+e.message)}
 finally{backupBusy=false;$('completeExport').disabled=false}
};
$('completeImport').onchange=async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||backupBusy)return;
 backupBusy=true;$('completeExport').disabled=true;
 try{
  backupStatus('バックアップを検査しています…');
  const inspected=await ElabCompleteBackup.inspectFile(file,backupStatus);
  if(!confirm(inspected.works.works.length+'作品・'+inspected.manifest.images.length+'画像を追加で復元します。既存作品は上書きしません。実行しますか？')){backupStatus('復元を取り消しました。');return}
  const result=await ElabCompleteBackup.importAll(file,backupStatus);
  backupStatus('復元完了：'+result.works+'作品・'+result.images+'画像。');
  chosen=null;render();
 }catch(err){backupStatus('復元を中止しました：'+err.message+'。元の作品は削除していません。')}
 finally{backupBusy=false;$('completeExport').disabled=false}
};

$('newForm').onsubmit=e=>{e.preventDefault();operate(()=>{const w=S.create($('newTitle').value);$('newTitle').value='';select(w.id)})};
$('renameBtn').onclick=()=>operate(()=>S.rename(chosen,$('editTitle').value));
$('beginBtn').onclick=begin;$('pauseBtn').onclick=pause;$('resumeBtn').onclick=resume;
$('eventFilter').onchange=()=>{visibleEvents=10;render()};
$('moreEvents').onclick=()=>{visibleEvents+=10;render()};
phases.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p;b.dataset.phase=p;b.onclick=()=>operate(()=>{if(!running(current()))return;phase=p;emit('phase',{value:p})});(i<5?$('phaseBtns'):$('extraPhaseBtns')).appendChild(b)});
for(let i=1;i<=10;i++){const p=document.createElement('button');p.textContent=i;p.type='button';p.onclick=()=>{pauseMoodScore=i;updatePauseMood()};$('pauseMoodChoices').appendChild(p)}
$('pauseMoodSkip').onclick=dismissPauseMood;
$('pauseMoodSave').onclick=()=>{if(!pendingPause)return;const pending={...pendingPause};try{const w=S.get(pending.workId);if(!w||!evs(w).some(e=>e.type==='pause'&&e.t===pending.pauseAt))throw Error('対象の休憩記録が見つかりません');S.observe(pending.workId,'score',{value:pauseMoodScore,phase,sessionEndAt:pending.pauseAt,source:'pause-prompt'});moodComment='今の気分を観測できました！';dismissPauseMood();render()}catch(err){alert('気分を保存できませんでした。\n'+err.message)}};

document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.status));
$('oneExport').onclick=()=>operate(()=>download('E-lab-work-'+chosen+'.json',S.exportWork(chosen)));
$('allExport').onclick=()=>operate(()=>download('E-lab-all-works-'+new Date().toISOString().slice(0,10)+'.json',S.exportAll()));
$('oneImport').onchange=e=>{const file=e.target.files[0];fileRead(file,text=>{const doc=JSON.parse(text),id=doc.work?.id,exists=id&&S.get(id);if(exists&&!confirm('同じ作品IDが存在します。バックアップの内容で上書きしますか？'))return;S.importWork(doc,{replace:!!exists});select(id)});e.target.value=''};
$('allImport').onchange=e=>{const file=e.target.files[0];fileRead(file,text=>{const doc=JSON.parse(text);if(!confirm('現在の全作品が置き換わります。事前にバックアップを取りましたか？'))return;S.importAll(doc,{replace:true});chosen=null});e.target.value=''};
$('deleteBtn').onclick=()=>operate(()=>{const w=current();if(!w)return;if(!confirm('作品「'+w.title+'」と全観測履歴を削除しますか？'))return;if(!confirm('この操作は元に戻せません。バックアップを確認しましたか？'))return;alert('画像ファイルは別保存です。画像を削除する場合は、先に画像観測室から削除してください。');S.remove(chosen);chosen=null});
// Built-in researcher portraits. No uploading or ZIP extraction in the app.
const WARDROBE_KEY='elab_builtin_outfits_v1';
const STAFF_ASSETS={kokoro:['kokoro-a.webp','kokoro-b.webp','kokoro-c.webp'],ritsu:['ritsu-a.webp','ritsu-b.webp','ritsu-c.webp']};
function selectedStaff(){try{const d=JSON.parse(localStorage.getItem(WARDROBE_KEY)||'{}');return {kokoro:[0,1,2].includes(d.kokoro)?d.kokoro:0,ritsu:[0,1,2].includes(d.ritsu)?d.ritsu:0}}catch{return {kokoro:0,ritsu:0}}}
function saveStaff(role,n){const data=selectedStaff();data[role]=n;localStorage.setItem(WARDROBE_KEY,JSON.stringify(data));updateResearcherPortraits()}
function staffSrc(role,n){return './'+STAFF_ASSETS[role][n]}
function updateResearcherPortraits(){
 const selected=selectedStaff();
 for(const role of ['kokoro','ritsu']){
  const main=$(role+'Portrait'),wardrobe=$(role+'WardrobePortrait'),fallback=$(role+'Fallback'),wardrobeFallback=$(role+'WardrobeFallback');
  const src=staffSrc(role,selected[role]);
  main.onerror=()=>{main.classList.add('hidden');fallback.classList.remove('hidden')};
  main.onload=()=>{main.classList.remove('hidden');fallback.classList.add('hidden')};
  main.src=src;
  wardrobe.onerror=()=>{wardrobe.style.display='none';wardrobeFallback.style.display='grid'};
  wardrobe.onload=()=>{wardrobe.style.display='block';wardrobeFallback.style.display='none'};
  wardrobe.src=src;
  const area=$(role+'Variants');area.replaceChildren();
  for(let n=0;n<STAFF_ASSETS[role].length;n++){
   const btn=document.createElement('button');btn.type='button';btn.classList.toggle('active',n===selected[role]);btn.title=role+' '+String.fromCharCode(65+n);
   const pic=document.createElement('img');pic.src=staffSrc(role,n);pic.alt='';
   const name=document.createElement('span');name.textContent=String.fromCharCode(65+n);btn.append(pic,name);
   btn.onclick=()=>saveStaff(role,n);area.append(btn);
  }
 }
}
function toggleWardrobe(open){document.body.classList.toggle('wardrobe-open',!!open);$('wardrobeScreen').classList.toggle('visible',!!open);window.scrollTo(0,0)}
$('openWardrobe').onclick=()=>toggleWardrobe(true);
$('closeWardrobe').onclick=()=>toggleWardrobe(false);
document.querySelectorAll('[data-open-wardrobe]').forEach(b=>b.onclick=()=>toggleWardrobe(true));
updateResearcherPortraits();
function renderChallenges(){
 const all=S.listChallenges(),filter=$('challengeFilter').value,list=$('challengeList');
 $('challengeCount').textContent=all.filter(t=>t.state==='active').length+'件の課題が進行中 / 計'+all.length+'件';
 list.replaceChildren();
 const filtered=all.filter(t=>filter==='all'||t.state===filter);
 if(!filtered.length){const info=document.createElement('div');info.className='small';info.textContent=filter==='active'?'課題はまだありません。制作中の気づきを残そう。':'表示する課題がありません。';list.append(info);return}
 const workNames=new Map(S.list().map(w=>[w.id,w.title]));
 for(const task of filtered){
  const card=document.createElement('div');card.style.cssText='background:#202d4b;border:1px solid #495b88;border-radius:11px;padding:10px;display:grid;gap:7px';
  const text=document.createElement('div');text.textContent=task.text;text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px';
  const source=document.createElement('div');source.className='small';source.textContent=(workNames.get(task.workId)||'作品未指定')+' から / '+stamp(task.createdAt)+(task.state==='archived'?' / 保管済み':'');
  const controls=document.createElement('div');controls.className='row';
  const edit=document.createElement('button');edit.className='ghost';edit.textContent='編集';edit.onclick=()=>{
   const revised=prompt('課題を編集（500文字まで）',task.text);
   if(revised===null)return;
   operate(()=>S.editChallenge(task.id,revised));
  };
  const status=document.createElement('button');status.textContent=task.state==='active'?'保管する':'再び取り組む';
  status.onclick=()=>operate(()=>S.setChallengeState(task.id,task.state==='active'?'archived':'active'));
  const del=document.createElement('button');del.className='danger';del.textContent='削除';del.onclick=()=>{
   if(!confirm('課題「'+task.text.slice(0,60)+'」を完全に削除しますか？'))return;
   operate(()=>S.deleteChallenge(task.id));
  };
  controls.append(edit,status,del);card.append(text,source,controls);list.append(card);
 }
}
$('challengeForm').onsubmit=e=>{e.preventDefault();operate(()=>{S.addChallenge($('challengeText').value,chosen||'');$('challengeText').value=''})};
$('challengeFilter').onchange=renderChallenges;
const socialFields=[['views','socialViews','表示'],['likes','socialLikes','いいね'],['reposts','socialReposts','リポスト'],['replies','socialReplies','返信'],['bookmarks','socialBookmarks','保存']];
$('socialForm').onsubmit=e=>{e.preventDefault();operate(()=>{
 const data={platform:$('socialPlatform').value,postUrl:$('socialUrl').value.trim(),note:$('socialNote').value.trim()};
 for(const [key,id] of socialFields){
  const raw=$(id).value.trim(),n=raw===''?null:Number(raw);
  if(n!==null&&(!Number.isSafeInteger(n)||n<0||n>1e12))throw Error('SNSの数字は0以上の整数にしてください');
  data[key]=n;
 }
 if(data.postUrl&&!data.postUrl.startsWith('https://'))throw Error('URLはhttps://で始めてください');
 if(socialFields.every(([key])=>data[key]===null)&&!data.note)throw Error('数字またはメモを記録してください');
 S.observe(chosen,'social',data);
 $('socialNote').value='';
})};
function renderSocial(w){
 const all=w.events.filter(e=>e.type==='social').slice().reverse(),area=$('socialHistory');
 area.replaceChildren();$('socialCount').textContent=all.length+'回観測';
 if(!all.length){const empty=document.createElement('div');empty.className='small';empty.textContent='SNSの反応はまだ記録されていません。';area.append(empty);return}
 for(const e of all.slice(0,20)){
  const card=document.createElement('div');card.style.cssText='padding:9px;border:1px solid #475c8b;border-radius:10px;background:#202d4b;display:grid;gap:5px';
  const header=document.createElement('div');header.className='small';header.textContent=stamp(e.t)+' / '+e.platform;
  const metrics=document.createElement('div');metrics.className='small';metrics.textContent=socialFields.map(([key,id,label])=>label+' '+(e[key]===null?'未観測':Number(e[key]).toLocaleString('ja-JP'))).join(' ・ ');
  card.append(header,metrics);
  if(e.note){const note=document.createElement('div');note.textContent=e.note;note.className='small';card.append(note)}
  if(e.postUrl){const link=document.createElement('a');link.textContent='投稿を見る';link.href=e.postUrl;link.rel='noopener noreferrer';link.target='_blank';link.style.color='#b6caff';card.append(link)}
  area.append(card);
 }
 if(all.length>20){const info=document.createElement('div');info.className='small';info.textContent='直近20件を表示。全件は観測履歴に保存されています。';area.append(info)}
}
const savedInspiration=S.getInspiration();$('kokoroGoal').value=savedInspiration.goal;$('kokoroMemo').value=savedInspiration.memo;
$('saveInspiration').onclick=()=>operate(()=>{S.saveInspiration($('kokoroGoal').value,$('kokoroMemo').value);$('inspirationStatus').textContent='保存しました！ こころ「大切に取っておきますね！」'});
let galleryToken=0,galleryUrls=[];
async function refreshGallery(){
 const token=++galleryToken;galleryUrls.forEach(u=>URL.revokeObjectURL(u));galleryUrls=[];
 const area=$('kokoroGallery');area.replaceChildren();
 const works=S.list().filter(w=>w.status==='完成').reverse();$('galleryCount').textContent=works.length+'点';
 if(!works.length){const empty=document.createElement('div');empty.className='small';empty.textContent='完成作品がここに増えていきます！';area.append(empty);return}
 for(const work of works){
  if(token!==galleryToken)return;
  const card=document.createElement('button');card.type='button';card.className='gallery-card';
  const label=document.createElement('span');label.textContent=work.title;
  card.onclick=()=>{select(work.id);$('artworkHero').scrollIntoView({behavior:'smooth',block:'start'})};
  try{
   const imgs=await I.list(work.id);if(token!==galleryToken)return;
   if(imgs.length){const pic=document.createElement('img'),url=URL.createObjectURL(imgs[0].blob);galleryUrls.push(url);pic.src=url;pic.alt=work.title;card.append(pic)}
  }catch(err){const note=document.createElement('span');note.textContent='画像を読み込めませんでした';card.append(note)}
  card.append(label);area.append(card);
 }
}
function render(){const works=S.list(),w=current();renderChallenges();$('workCount').textContent='登録作品 '+works.length+' 件';$('workList').innerHTML=works.length?'':'<div class="sub">まだ作品がありません。</div>';
for(const p of works){const b=document.createElement('button');b.className='work'+(p.id===chosen?' selected':'');b.innerHTML='<b>'+esc(p.title)+'</b><span>'+esc(p.status)+' ・ 気分 '+evs(p).filter(e=>e.type==='score').length+'件 ・ '+stamp(p.createdAt)+'</span>';b.onclick=()=>operate(()=>select(p.id));$('workList').appendChild(b)}
$('emptyState').classList.toggle('hidden',!!w);$('workspace').classList.toggle('hidden',!w);$('workStatus').textContent=w?w.status:'未選択';
if(!w){++imageRequest;++colorRequest;++instrumentRequest;clearImageUrls();$('timelineView').replaceChildren();$('instrumentContent').classList.add('hidden');$('instrumentState').textContent='観測待ち';$('instrumentText').textContent='作品を選択すると観測できます。';return;}
if(window.ElabTimeline)ElabTimeline.render($('timelineView'),w);renderSocial(w);if(document.activeElement!==$('editTitle'))$('editTitle').value=w.title;
const run=running(w),has=started(w),open=w.status==='制作中';
$('runningState').textContent=run?'観測中':has?'休憩中':'未開始';
$('timer').textContent=fmt(elapsed(w));
$('beginBtn').disabled=!open||has;$('pauseBtn').disabled=!run;$('resumeBtn').disabled=!open||!has||run;
$('eventCount').textContent=w.events.length+'件';
[...$('phaseBtns').children,...$('extraPhaseBtns').children].forEach(b=>{b.disabled=!run;b.classList.toggle('active',b.dataset.phase===phase)});


document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('active',b.dataset.status===w.status));
const lastMood=evs(w).filter(e=>e.type==='score').at(-1);
$('leftMessage').textContent='こころ「'+(completionTalk?.id===w.id?completionTalk.kokoro:moodComment||(lastMood?.value<=3?'今日は静かな観測ですねえ……':'今日は何が見つかるでしょうね！'))+'」';
$('rightMessage').textContent='律「'+(completionTalk?.id===w.id?completionTalk.ritsu:lastMood?'直近の気分は'+lastMood.value+'です。理由は不明です。':'まだ気分の観測値はありません。')+'」';
const names={start:'制作開始',pause:'休憩',resume:'制作再開',finish:'終了',phase:'工程変更',score:'気分観測',status:'作品状態',image:'画像観測',social:'SNS反応'};
const filter=$('eventFilter').value;
const matching=w.events.filter(e=>filter==='all'||e.type===filter||(filter==='operation'&&['start','pause','resume','finish'].includes(e.type))).reverse();
$('eventCount').textContent=w.events.length+'件保存 / '+matching.length+'件該当';
$('events').innerHTML=matching.slice(0,visibleEvents).map(e=>'<div class="event"><time>'+stamp(e.t)+'</time>　'+esc(names[e.type]||e.type)+'　'+esc(e.type==='score'?e.value+' / 10':e.type==='image'?e.name||'画像':e.type==='social'?e.platform+' いいね '+(e.likes===null?'未観測':e.likes):e.value||e.reason||'')+'</div>').join('')||(w.events.length?'該当する記録はありません。':'まだ観測履歴がありません。');
$('moreEvents').classList.toggle('hidden',matching.length<=visibleEvents);
$('moreEvents').textContent='さらに10件表示（残り'+Math.max(0,matching.length-visibleEvents)+'件）';
}
render();refreshGallery();setInterval(()=>{const w=current();if(w&&running(w))$('timer').textContent=fmt(elapsed(w))},1000);
})();
