/* E-lab complete ZIP backup / restore v0.1
 * Includes work JSON and original image blobs, never researcher art.
 * Safe restore: declines duplicate work IDs instead of replacing existing data.
 */
(function(g){'use strict';
const MAX_ARCHIVE=600*1024*1024,MAX_IMAGE=30*1024*1024,MAX_IMAGES=4000;
const SCHEMA='elab-complete-zip-v1';
const S=()=>g.ElabWorksStore,I=()=>g.ElabImageStore;
const assert=(yes,msg)=>{if(!yes)throw Error(msg)};
const date=()=>new Date().toISOString().replace(/[:.]/g,'-');
function getZip(){assert(g.JSZip,'ZIPライブラリを読み込めません。ネット接続を確認してください');return g.JSZip}
const filename=id=>encodeURIComponent(id).replace(/%/g,'_');
async function exportAll(onProgress){
 const workStore=S(),imageStore=I(),data=workStore.read();
 const zip=new (getZip())(),manifest={schema:SCHEMA,createdAt:new Date().toISOString(),works:data.works.length,images:[]};
 zip.file('works.json',JSON.stringify(data));
 let count=0;
 for(const work of data.works){
  const items=await imageStore.list(work.id);
  for(const im of items){
   count++;assert(count<=MAX_IMAGES,'バックアップ画像が多すぎます。分割保存が必要です');
   const path='images/'+filename(work.id)+'/'+filename(im.id)+'.bin';
   zip.file(path,im.blob,{binary:true,compression:'STORE'});
   const {blob,...meta}=im;
   manifest.images.push({...meta,path});
   if(onProgress)onProgress('画像をまとめています：'+count+'枚');
  }
 }
 zip.file('manifest.json',JSON.stringify(manifest,null,2));
 if(onProgress)onProgress('ZIPを書き出しています…');
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:1}});
 return {blob,name:'E-lab_complete_'+date()+'.zip',workCount:data.works.length,imageCount:count};
}
function validName(p){return typeof p==='string'&&p.startsWith('images/')&&!p.includes('..')&&!p.startsWith('/')&&p.length<500}
async function inspectFile(file,onProgress){
 assert(file&&file.size<=MAX_ARCHIVE,'バックアップZIPは600MB以下にしてください');
 const zip=await getZip().loadAsync(file);
 assert(zip.file('manifest.json')&&zip.file('works.json'),'E-labの完全バックアップZIPではありません');
 const [man,works]=await Promise.all([zip.file('manifest.json').async('string').then(JSON.parse),zip.file('works.json').async('string').then(JSON.parse)]);
 assert(man.schema===SCHEMA,'対応していないバックアップ形式です');
 assert(works?.schema===S().SCHEMA&&Array.isArray(works.works),'作品データが不正です');
 S().validateBackup(works);
 assert(Array.isArray(man.images)&&man.images.length<=MAX_IMAGES,'画像一覧が不正です');
 assert(man.works===works.works.length,'作品件数が一致しません');
 const ids=new Set(),paths=new Set(),workIds=new Set(works.works.map(x=>x.id));
 assert(workIds.size===works.works.length,'作品IDが重複しています');
 for(const im of man.images){
  assert(typeof im.id==='string'&&im.id.length>0&&!ids.has(im.id),'画像IDが不正または重複しています');
  assert(workIds.has(im.workId),'所属する作品がない画像があります');
  assert(validName(im.path)&&!paths.has(im.path)&&!!zip.file(im.path),'画像ファイルが不足しています');
  assert(Number.isFinite(im.bytes)&&im.bytes>=0&&im.bytes<=MAX_IMAGE,'画像サイズが不正です');
  assert(!(await I().get(im.id)),'同じ画像IDが既に保存されています。データ保護のため復元できません');
  ids.add(im.id);paths.add(im.path);
 }
 // Fully validate work/event schema through the public store's importer shape,
 // without writes: validation happens again in importWork at commit time.
 for(const w of works.works){
  assert(w&&typeof w.id==='string'&&typeof w.title==='string'&&typeof w.status==='string'&&Array.isArray(w.events),'作品形式が不正です');
  for(const ev of w.events)assert(ev&&typeof ev.type==='string'&&Number.isFinite(ev.t),'観測記録が不正です');
 }
 const existing=new Set(S().list().map(w=>w.id));
 assert(!works.works.some(w=>existing.has(w.id)),'同じIDの作品が既にあります。データ保護のため復元を中止しました。');
 if(onProgress)onProgress('ZIPの内容を検査しています…');
 return {zip,manifest:man,works};
}
async function importAll(file,onProgress){
 const {zip,manifest,works}=await inspectFile(file,onProgress);
 const images=[];
 for(const m of manifest.images){
  const blob=await zip.file(m.path).async('blob');
  assert(blob.size===m.bytes,'画像データのサイズが一致しません');
  assert(blob.size<=MAX_IMAGE,'画像サイズの上限を超えています');
  images.push({...m,blob:blob.slice(0,blob.size,m.type||'image/png')});
  delete images[images.length-1].path;
 }
 // Recheck before first write; no replace/overwrite of existing work records.
 const existing=new Set(S().list().map(w=>w.id));
 assert(!works.works.some(w=>existing.has(w.id)),'復元直前に作品の重複が見つかりました');
 for(const im of images)assert(!(await I().get(im.id)),'復元直前に同じ画像IDが見つかりました');
 if(onProgress)onProgress('画像を端末に保存しています…');
 if(images.length)await I().importRecords(images);
 if(onProgress)onProgress('作品と観測履歴を復元しています…');
 let restored=0;
 for(const w of works.works){S().importWork({schema:S().SCHEMA,kind:'single-work',work:w},{replace:false});restored++}
 return {works:restored,images:images.length};
}
g.ElabCompleteBackup=Object.freeze({exportAll,inspectFile,importAll});
})(window);