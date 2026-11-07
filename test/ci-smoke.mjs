import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require=createRequire(import.meta.url);
const root=resolve(process.cwd());
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/test/')){res.writeHead(404);res.end();return}
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+'/test/')){res.writeHead(403);res.end();return}
  const body=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});
  res.end(body);
 }catch(e){res.writeHead(404);res.end(String(e.message))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,origin='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true});
let failures=0;
async function runTest(title,callback){
 const context=await browser.newContext();
 try{
  const page=await context.newPage();
  const jszip=await readFile(require.resolve('jszip/dist/jszip.min.js'),'utf8');
  await page.route('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:jszip}));
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await callback(page,errors);
  console.log('PASS',title);
 }catch(e){failures++;console.error('FAIL',title,e.stack||e)}
 finally{await context.close()}
}
await runTest('ZIP restore and cleanup in Chromium',async(page,errors)=>{
 await page.goto(origin+'/test/repair-smoke-v01.html?mode=test');
 await page.locator('#run').click();
 await page.getByText('基本テストは全件成功',{exact:false}).waitFor({timeout:15000});
 const out=await page.locator('#results').innerText();
 if(out.includes('❌')||out.includes('⚠'))throw Error(out);
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
});
await runTest('Works room creation, timer and pause',async(page,errors)=>{
 await page.goto(origin+'/test/works-room-v02.html?mode=test');
 await page.locator('#newTitle').fill('CI架空作品');
 await page.locator('#newForm button').click();
 await page.getByText('CI架空作品',{exact:false}).first().waitFor({timeout:10000});
 await page.locator('#beginBtn').click();
 await page.locator('#pauseBtn').click();
 const works=await page.evaluate(()=>window.ElabWorksStore.list());
 if(works.length!==1)throw Error('Expected one work, got '+works.length);
 if(!works[0].events.some(e=>e.type==='start')||!works[0].events.some(e=>e.type==='pause'))throw Error('Timer event was not saved');
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
});
await browser.close();
await new Promise(resolve=>server.close(resolve));
if(failures)process.exitCode=1;
