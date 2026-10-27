/* E-lab timeline v0.1 — read-only visualization of saved observations */
(function(g){'use strict';
const COLORS={ラフ:'#8ba7f6',線画:'#d0a2f5',着彩:'#eba990',仕上げ:'#a4dfb7',休憩:'#52607f'};
const PHASES=['ラフ','線画','着彩','仕上げ'];
const time=n=>new Date(n).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
const duration=ms=>{const min=Math.floor(ms/60000);return min>=60?Math.floor(min/60)+'時間'+(min%60)+'分':min+'分'};
function compute(work,now=Date.now()){
 const events=[...(work?.events||[])].filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);
 const begin=events.find(e=>e.type==='start');
 if(!begin)return null;
 let stage='ラフ',active=false,started=false,last=begin.t;
 const segments=[],moods=[],images=[];
 const add=(end)=>{
  if(!started||end<=last)return;
  segments.push({from:last,to:end,stage:active?stage:'休憩',active});
 };
 for(const e of events){
  if(e.t<begin.t)continue;
  const type=e.type;
  if(['start','pause','resume','finish','phase'].includes(type)){
   add(e.t);last=e.t;
   if(type==='start'||type==='resume'){active=true;started=true}
   if(type==='pause'||type==='finish')active=false;
   if(type==='phase'&&PHASES.includes(e.value))stage=e.value;
  }
  if(type==='score'&&Number.isInteger(e.value)&&e.value>=1&&e.value<=10)moods.push({t:e.t,score:e.value});
  if(type==='image')images.push({t:e.t});
 }
 const end=Math.max(begin.t,active?now:last,...moods.map(e=>e.t),...images.map(e=>e.t));
 if(active)add(now);
 const total=Math.max(1,end-begin.t),durations={ラフ:0,線画:0,着彩:0,仕上げ:0,休憩:0};
 for(const s of segments)durations[s.stage]+=s.to-s.from;
 return {begin:begin.t,end,total,segments,moods,images,durations,active};
}
function render(node,work,now=Date.now()){
 node.replaceChildren();
 const data=compute(work,now);
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 if(!data){node.append(el('p','timeline-muted','制作を開始すると、工程・休憩・気分の変化を自動で表示します。'));return}
 const meta=el('div','timeline-meta');
 meta.append(el('span','',time(data.begin)+' 開始'),el('span','',data.active?'制作中':'最終記録 '+time(data.end)));
 node.append(meta);
 const rail=el('div','timeline-rail');
 const cappedMs=Math.max(data.total,60000);
 for(const seg of data.segments){
  const width=Math.max(0,(seg.to-seg.from)/cappedMs*100);
  if(width<.025)continue;
  const item=el('div','timeline-segment');
  item.style.width=width+'%';item.style.background=COLORS[seg.stage];item.title=seg.stage+' '+time(seg.from)+'〜'+time(seg.to)+'（'+duration(seg.to-seg.from)+'）';
  rail.append(item);
 }
 if(!data.segments.length)rail.append(el('span','timeline-muted','経過を記録中'));
 node.append(rail);
 const legend=el('div','timeline-legend');
 for(const label of ['ラフ','線画','着彩','仕上げ','休憩']){
  const tag=el('span','timeline-key');
  const swatch=el('i','timeline-swatch');swatch.style.background=COLORS[label];
  tag.append(swatch,document.createTextNode(label+' '+duration(data.durations[label])));
  legend.append(tag);
 }
 node.append(legend);
 const header=el('div','timeline-caption','気分の観測（点を押すと日時を表示）');
 node.append(header);
 const chart=el('div','timeline-moods');
 for(let value=2;value<=8;value+=2){const line=el('div','timeline-guide');line.style.bottom=(value-1)/9*100+'%';chart.append(line)}
 for(const m of data.moods){
  const dot=el('button','timeline-dot');
  dot.type='button';dot.textContent=String(m.score);
  dot.style.left=Math.max(3,Math.min(97,(m.t-data.begin)/cappedMs*100))+'%';
  dot.style.bottom=(m.score-1)/9*88+5+'%';
  dot.title=time(m.t)+' / 気分 '+m.score+'/10';
  dot.setAttribute('aria-label',dot.title);
  dot.onclick=()=>{dot.title=time(m.t)+'　気分 '+m.score+'/10';const info=node.querySelector('.timeline-info');if(info)info.textContent=dot.title};
  chart.append(dot);
 }
 if(!data.moods.length){chart.append(el('span','timeline-muted','気分の記録が増えると、ここに点が並びます。'))}
 node.append(chart);
 node.append(el('div','timeline-info',data.moods.length+'回の気分観測 / '+data.images.length+'回の画像登録'));
 const footer=el('div','timeline-muted','工程は記録時刻で区切った推定です。休憩や記録間隔によって見え方が変わります。');
 node.append(footer);
}
g.ElabTimeline=Object.freeze({compute,render});
})(window);