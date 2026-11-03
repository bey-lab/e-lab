/* E-lab timeline v0.1 — read-only visualization of saved observations */
(function(g){'use strict';
const COLORS={ラフ:'#8ba7f6',色面:'#8fd8cd',陰影:'#f0be87',線画:'#d0a2f5',仕上げ:'#a4dfb7',構想:'#c0b8f8',資料集め:'#9ecbe1',下描き:'#aab0ef',下塗り:'#9ccfc0',背景:'#a3bf8c',加工:'#d4abce',その他:'#a9b3cd',未分類:'#8e9cb7',着彩:'#eba990',休憩:'#52607f'};
const PHASES=['ラフ','色面','陰影','線画','仕上げ','構想','資料集め','下描き','下塗り','背景','加工','その他','未分類','着彩'];
let showBreaks=false; // UI preference only; never modifies saved observations.
const time=n=>new Date(n).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
const duration=ms=>{const min=Math.floor(ms/60000);return min>=60?Math.floor(min/60)+'時間'+(min%60)+'分':min+'分'};
function compute(work,now=Date.now()){
 const events=[...(work?.events||[])].filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);
 const begin=events.find(e=>e.type==='start');
 if(!begin)return null;
 let stage='ラフ',active=false,started=false,last=begin.t;
 const segments=[],moods=[],images=[],sessions=[];let sessionStart=null;
 const add=(end)=>{
  if(!started||end<=last)return;
  segments.push({from:last,to:end,stage:active?stage:'休憩',active});
 };
 for(const e of events){
  if(e.t<begin.t)continue;
  const type=e.type;
  if(['start','pause','resume','finish','phase'].includes(type)){
   add(e.t);last=e.t;
   if(type==='start'||type==='resume'){active=true;started=true;sessionStart=e.t}
   if(type==='pause'||type==='finish'){
    if(active&&sessionStart!==null)sessions.push({start:sessionStart,end:e.t,kind:type});
    active=false;sessionStart=null;
   }
   if(type==='phase'&&PHASES.includes(e.value))stage=e.value;
  }
  if(type==='score'&&Number.isInteger(e.value)&&e.value>=1&&e.value<=10)moods.push({t:e.t,score:e.value,sessionEndAt:Number.isFinite(e.sessionEndAt)?e.sessionEndAt:null});
  if(type==='image')images.push({t:e.t});
 }
 const end=Math.max(begin.t,active?now:last,...moods.map(e=>e.t),...images.map(e=>e.t));
 if(active){add(now);if(sessionStart!==null)sessions.push({start:sessionStart,end:now,kind:'running'})}
 const total=Math.max(1,end-begin.t),durations=Object.fromEntries([...PHASES,'休憩'].map(p=>[p,0]));
 for(const s of segments)durations[s.stage]+=s.to-s.from;
 return {begin:begin.t,end,total,segments,moods,images,durations,active,sessions};
}
function render(node,work,now=Date.now()){
 node.replaceChildren();
 const data=compute(work,now);
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 if(!data){node.append(el('p','timeline-muted','制作を開始すると、工程・休憩・気分の変化を自動で表示します。'));return}
 const meta=el('div','timeline-meta');
 meta.append(el('span','',time(data.begin)+' 開始'),el('span','',data.active?'制作中':'最終記録 '+time(data.end)));
 node.append(meta);
 const breakControl=el('button','','');
 breakControl.type='button';
 breakControl.textContent=showBreaks?'休憩を隠す':'休憩を表示';
 breakControl.setAttribute('aria-pressed',String(showBreaks));
 breakControl.style.cssText='padding:7px 12px;margin:8px 0;font-size:12px;border-radius:9px;cursor:pointer';
 breakControl.onclick=()=>{showBreaks=!showBreaks;render(node,work)};
 node.append(breakControl);
 const rail=el('div','timeline-rail');
 const shownSegments=data.segments.filter(s=>showBreaks||s.active);
 const shownDuration=shownSegments.reduce((sum,s)=>sum+s.to-s.from,0);
 const cappedMs=Math.max(1,shownDuration);
 for(const seg of shownSegments){
  const width=Math.max(0,(seg.to-seg.from)/cappedMs*100);
  if(width<.025)continue;
  const item=el('div','timeline-segment');
  item.style.width=width+'%';item.style.background=COLORS[seg.stage]||COLORS['未分類'];item.title=seg.stage+' '+time(seg.from)+'〜'+time(seg.to)+'（'+duration(seg.to-seg.from)+'）';
  rail.append(item);
 }
 if(!shownSegments.length)rail.append(el('span','timeline-muted','制作時間の記録がありません'));
 node.append(rail);
 node.append(el('div','timeline-muted',showBreaks?'休憩時間を含めた割合で表示中':'制作時間だけで工程の割合を表示中（休憩記録は保存済み）'));
 const legend=el('div','timeline-legend');
 for(const label of [...PHASES.filter(p=>data.durations[p]>0),...(showBreaks?['休憩']:[])]){
  const tag=el('span','timeline-key');
  const swatch=el('i','timeline-swatch');swatch.style.background=COLORS[label];
  tag.append(swatch,document.createTextNode(label+' '+duration(data.durations[label])));
  legend.append(tag);
 }
 node.append(legend);
 const header=el('div','timeline-caption','制作セッションごとの楽しさ（1〜10）');
 node.append(header);
 const sessionBoard=el('div','');
 sessionBoard.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0';
 const assigned=new Set();
 for(const [i,session] of data.sessions.entries()){
  const nextStart=data.sessions[i+1]?.start??Infinity;
  const candidates=data.moods.filter(m=>m.sessionEndAt===session.end||(m.sessionEndAt===null&&m.t>=session.start&&m.t<nextStart));
  const latest=candidates.at(-1);
  candidates.forEach(m=>assigned.add(m));
  const card=el('div','');
  card.style.cssText='padding:11px 12px;border:1px solid #55698f;border-radius:12px;min-width:85px;background:#283758;text-align:center';
  const top=el('div','timeline-muted',(i+1)+'回目');top.style.fontSize='12px';
  const value=el('div','',latest?latest.score+' / 10':'—');
  value.style.cssText='font-size:20px;font-weight:800;margin:4px 0';
  const sub=el('div','timeline-muted',session.kind==='running'?'制作中':latest?'記録あり':'未記録');
  card.title=time(session.start)+'〜'+time(session.end)+(latest?'／楽しさ '+latest.score+'/10':'／気分未記録');
  card.append(top,value,sub);sessionBoard.append(card);
 }
 if(!data.sessions.length)sessionBoard.append(el('p','timeline-muted','制作の開始・休憩を記録すると表示します。'));
 node.append(sessionBoard);
 const legacy=data.moods.filter(m=>!assigned.has(m));
 if(legacy.length){
  node.append(el('div','timeline-muted','セッションに紐づかない以前の気分記録：'+legacy.map(m=>time(m.t)+' '+m.score+'/10').join(' ／ ')));
 }
 node.append(el('div','timeline-info',data.sessions.length+'回の制作セッション / '+data.moods.length+'回の気分観測 / '+data.images.length+'回の画像登録'));
 const footer=el('div','timeline-muted','制作時間の工程別集計は休憩を除きます。気分未記録の回は「—」と表示し、数値を補いません。');
 node.append(footer);
}
g.ElabTimeline=Object.freeze({compute,render});
})(window);