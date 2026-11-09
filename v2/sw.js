/* E-lab V2 offline shell. Only public app assets are cached; research data stays in localStorage/IndexedDB. */
"use strict";
const CACHE="elab-v2-shell-2026-11-10-research-tree-01";
const SHELL=[
 "./","./index.html","./images.js",
 "./assets/assistants/kokoro-full.png",
 "./assets/assistants/ritsu-full.png",
 "./assets/assistants/mayumi-full.png"
];
const scope=new URL(self.registration.scope);
const shellPaths=new Set(SHELL.map(path=>new URL(path,scope).pathname));
const homePath=new URL("./index.html",scope).pathname;
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(SHELL.map(x=>new Request(new URL(x,scope).href,{cache:"reload"})));
  await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith("elab-v2-shell-")&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 // This worker never intercepts the independent sandbox or unrelated GitHub Pages.
 if(!shellPaths.has(url.pathname))return;
 if(request.mode==="navigate"){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(homePath,response.clone());}
    return response;
   }catch{
    const cache=await caches.open(CACHE);
    const saved=await cache.match(request,{ignoreSearch:true})||await cache.match(homePath);
    return saved||Response.error();
   }
  })());
 }else{
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const saved=await cache.match(request,{ignoreSearch:true});
   if(saved)return saved;
   const response=await fetch(request);
   if(response.ok)await cache.put(request,response.clone());
   return response;
  })());
 }
});
