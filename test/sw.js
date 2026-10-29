/* E-lab Offline Kit v1 — scope: /e-lab/test/
   Static app shell only. Artwork records remain in localStorage/IndexedDB. */
'use strict';
const VERSION='elab-offline-v9-20261029-recovery-diagnostics';
const SHELL=VERSION+'-shell';
const RUNTIME=VERSION+'-runtime';
const ROOT=new URL('./',self.registration.scope);
const ASSETS=[
 'works-room-v02.html',
 'works-store-v02.js',
 'images-v03.js',
 'color-band-v01.js',
 'observation-v01.js',
 'timeline-v01.js',
 'complete-backup-v01.js',
 'kokoro-a.webp','kokoro-b.webp','kokoro-c.webp',
 'ritsu-a.webp','ritsu-b.webp','ritsu-c.webp'
];
const ZIP_LIB='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const assetUrls=ASSETS.map(path=>new URL(path,ROOT).href);
const htmlUrl=new URL('works-room-v02.html',ROOT).href;
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const shell=await caches.open(SHELL);
  // Successful installation requires the complete local app shell.
  await shell.addAll(assetUrls.map(url=>new Request(url,{cache:'reload'})));
  // The zip library is cached separately; failure must not prevent offline drawing.
  try{
   const res=await fetch(ZIP_LIB,{mode:'cors',cache:'reload'});
   if(res.ok){const runtime=await caches.open(RUNTIME);await runtime.put(ZIP_LIB,res)}
  }catch(_err){}
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys()){
   if(key.startsWith('elab-offline-')&&key!==SHELL&&key!==RUNTIME)await caches.delete(key);
  }
  await self.clients.claim();
 })());
});
async function navigate(request){
 try{
  const response=await fetch(request);
  if(response.ok){
   const cache=await caches.open(SHELL);
   await cache.put(htmlUrl,response.clone());
  }
  return response;
 }catch(_err){
  return (await caches.match(htmlUrl))||
   new Response('E-lab のオフライン準備ができていません。オンラインで一度開いてください。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
}
async function staticFile(request){
 const cached=await caches.match(request,{ignoreSearch:true});
 if(cached)return cached;
 try{
  const response=await fetch(request);
  if(response.ok||response.type==='opaque'){
   const cache=await caches.open(RUNTIME);
   await cache.put(request,response.clone());
  }
  return response;
 }catch(_err){
  return new Response('Offline resource missing',{status:503});
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(request.mode==='navigate'&&url.origin===self.location.origin&&url.pathname.startsWith(ROOT.pathname)){
  event.respondWith(navigate(request));return;
 }
 if(url.origin===self.location.origin&&url.pathname.startsWith(ROOT.pathname)){
  event.respondWith(staticFile(request));return;
 }
 if(url.href===ZIP_LIB){event.respondWith(staticFile(request))}
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ELAB_OFFLINE_STATUS'){
  event.waitUntil((async()=>{
   const shell=await caches.open(SHELL);
   const found=await Promise.all(assetUrls.map(url=>shell.match(url)));
   const zip=await caches.match(ZIP_LIB);
   event.source?.postMessage({type:'ELAB_OFFLINE_STATUS',ready:found.every(Boolean),files:found.filter(Boolean).length,total:found.length,zipReady:!!zip});
  })());
 }
});
