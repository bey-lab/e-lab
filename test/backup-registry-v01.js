/* E-lab Backup Registry v1: common export adapters. Non-destructive, backup only.
   Future tools register providers instead of changing the ZIP orchestration. */
(function(g){'use strict';
const providers=new Map();
function register(provider){
 if(!provider||typeof provider.id!=='string'||!(/^[a-z0-9-]{2,60}$/).test(provider.id)||typeof provider.export!=='function')throw Error('Invalid backup provider');
 if(providers.has(provider.id))throw Error('Duplicate backup provider: '+provider.id);
 providers.set(provider.id,provider);
}
function list(){return [...providers.values()].map(p=>({id:p.id,version:p.version||1,label:p.label||p.id}))}
async function build(){
 if(!g.JSZip)throw Error('ZIPライブラリを読み込めません。オンラインで再度開いてください');
 const archive=new g.JSZip(),entries=[],manifest={schema:'elab-backup-registry-v1',createdAt:new Date().toISOString(),components:[]};
 for(const p of providers.values()){
  const result=await p.export();
  if(!result||!Array.isArray(result.files))throw Error(p.id+' のバックアップ形式が不正です');
  for(const item of result.files){
   const path='components/'+p.id+'/'+item.name;
   if(!/^[a-zA-Z0-9._-]+$/.test(item.name))throw Error('Invalid file name');
   archive.file(path,item.content);
   entries.push(path);
  }
  manifest.components.push({id:p.id,version:p.version||1,files:result.files.map(f=>f.name),summary:result.summary||null});
 }
 archive.file('manifest.json',JSON.stringify(manifest,null,2));
 const blob=await archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:1}});
 return {blob,manifest,filename:'E-lab_registry_'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip'};
}
register({id:'works-and-images',version:1,label:'作品・画像・創作ノート・課題',export:async()=>{
 if(!g.ElabCompleteBackup)throw Error('現在の作品バックアップ機能が見つかりません');
 const result=await g.ElabCompleteBackup.exportAll();
 return {files:[{name:'complete-legacy-v1.zip',content:result.blob}],summary:{works:result.workCount,images:result.imageCount}};
}});
register({id:'knowledge-tree',version:1,label:'知識の樹',export:async()=>{
 const isTest=new URLSearchParams(location.search).get('mode')==='test',key=isTest?'elab_knowledge_tree_v1_test':'elab_knowledge_tree_v1';
 const raw=localStorage.getItem(key);
 let data={schema:'elab-knowledge-v1',unlocked:[]};
 if(raw!==null){data=JSON.parse(raw);if(data?.schema!=='elab-knowledge-v1'||!Array.isArray(data.unlocked))throw Error('知識の樹データが不正です。保存を中止します')}
 return {files:[{name:'unlocks.json',content:JSON.stringify(data)}],summary:{unlocked:data.unlocked.length}};
}});
g.ElabBackupRegistry=Object.freeze({register,list,build});
})(window);