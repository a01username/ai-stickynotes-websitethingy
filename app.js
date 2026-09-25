'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='little-thoughts-v1';let state={notes:[],edges:[],dark:false},selected=null,tool='select',color='#f6d86e',solid=true,connectionType='arrow',startNote=null,zoom=1,saveTimer,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.notes)&&Array.isArray(saved.edges))state=saved;}catch{setTimeout(()=>toast('Saved canvas could not be loaded. Browser storage may be unavailable.'),100)}
let areaSelection=new Set(), suppressCanvasClick=false;
let edgeFrame=0,zoomTimer=0;const edgeRoutes=new Map();
function queueEdgePreview(){if(!edgeFrame)edgeFrame=requestAnimationFrame(()=>{edgeFrame=0;renderEdges(true)})}
const noteById=id=>state.notes.find(n=>n.id===id), current=()=>noteById(selected);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3400)}
function save(){clearTimeout(saveTimer);$('#save-status').textContent='Saving…';saveTimer=setTimeout(flushSave,200)}
function flushSave(){try{localStorage.setItem(KEY,JSON.stringify(state));$('#save-status').textContent='Saved on this device'}catch{$('#save-status').textContent='Not saved';toast('Storage is full or unavailable. Keep this tab open to preserve your notes.')}}
window.addEventListener('pagehide',flushSave);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave()});
function theme(){document.body.classList.toggle('dark',state.dark);$('#theme').title=state.dark?'Switch to light mode':'Switch to dark mode';$('#theme').setAttribute('aria-label',$('#theme').title);$('#theme').setAttribute('aria-pressed',!!state.dark)}
$('#theme').onclick=()=>{state.dark=!state.dark;theme();save()};theme();
function point(e){const r=$('#viewport').getBoundingClientRect();return{x:(e.clientX-r.left+$('#viewport').scrollLeft)/zoom,y:(e.clientY-r.top+$('#viewport').scrollTop)/zoom}}
function group(n){return n.stack?state.notes.filter(x=>x.stack===n.stack):[n]}
function visibleNotes(){return state.notes.filter(n=>!n.stack||group(n).at(-1).id===n.id)}
function addNote(x,y,text=''){const r=$('#viewport').getBoundingClientRect();const n={id:crypto.randomUUID(),x:x??($('#viewport').scrollLeft+r.width*.48)/zoom,y:y??($('#viewport').scrollTop+r.height*.32)/zoom,text,color,solid,font:'Arial',size:20,ink:'#292923',mode:'text',strokes:[]};n.x=Math.max(90,n.x);n.y=Math.max(100,n.y);state.notes.push(n);setTool('select');selected=n.id;render();save();requestAnimationFrame(()=>document.getElementById(n.id)?.querySelector('.note-content').focus());return n}
function setTool(t){areaSelection.clear();tool=t;document.body.classList.toggle('drawing-board',t==='board-draw');$('#board-draw-controls').hidden=t!=='board-draw';startNote=null;$$('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',b.dataset.tool===t)});$('#viewport').style.cursor=t==='note'?'crosshair':'default';if(t!=='select'){selected=null;render()}if(t==='connect')toast('Click a note, then another to connect them.');if(t==='fill')toast('Choose a color, then click a note to fill it.');if(t==='note')toast('Click anywhere to place a note.')}
$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));$('#first-note').onclick=()=>addNote();
function select(n){areaSelection.clear();selected=n.id;render();}
function chooseFill(value){solid=value;$('#solid').classList.toggle('chosen',solid);$('#outline').classList.toggle('chosen',!solid);if(current()){current().solid=solid;render();save()}}
$('#solid').onclick=()=>chooseFill(true);$('#outline').onclick=()=>chooseFill(false);
$('#arrow').onclick=()=>{connectionType='arrow';$('#arrow').classList.add('chosen');$('#line').classList.remove('chosen')};$('#line').onclick=()=>{connectionType='line';$('#line').classList.add('chosen');$('#arrow').classList.remove('chosen')};
$('#color').oninput=e=>{color=e.target.value;if(current()){current().color=color;render();save()}};
function connect(a,b){if(a===b)return;if(state.edges.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a)))return;state.edges.push({id:crypto.randomUUID(),a,b,type:connectionType,color});save();renderEdges()}
function clickNote(n){if(tool==='fill'){n.color=color;save();render();return}if(tool==='connect'){if(startNote){if(startNote===n.id){toast('Choose a different note to finish the connection.');return;}connect(startNote,n.id);setTool('select');selected=n.id;render();toast('Connected. Select mode is active.')}else{startNote=n.id;toast('Now click the note to connect to.')}return}if(tool==='select'&&selected!==n.id)select(n)}
function render(){const holder=$('#notes');holder.replaceChildren();for(const n of visibleNotes()){
const el=document.createElement('article');el.id=n.id;el.className='note'+(selected===n.id||areaSelection.has(n.id)?' selected':'')+(!n.solid?' outlined':'')+(group(n).length>1?' stacked':'');el.style.cssText=`left:${n.x}px;top:${n.y}px;background:${n.solid?n.color:'var(--surface)'};border-color:${n.color};--note-color:${n.color};color:${n.ink}`;
const top=document.createElement('div');top.className='note-top';const grip=document.createElement('span');grip.textContent='⠿';grip.title='Drag note or stack';top.append(grip);
if(group(n).length>1){const nav=document.createElement('span');nav.className='stack-nav';const prev=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');prev.textContent='‹';next.textContent='›';prev.setAttribute('aria-label','Previous note in stack');next.setAttribute('aria-label','Next note in stack');count.textContent=group(n).length+' notes';prev.onclick=e=>{e.stopPropagation();cycle(n,-1)};next.onclick=e=>{e.stopPropagation();cycle(n,1)};const separate=document.createElement('button');separate.textContent='Separate';separate.title='Spread all notes in this stack apart';separate.setAttribute('aria-label','Separate stack');separate.onclick=e=>{e.stopPropagation();separateStack(n)};nav.append(prev,count,next,separate);top.append(nav)}else{const type=document.createElement('span');type.textContent=n.mode==='draw'?'scribble':'thought';top.append(type)}
const close=document.createElement('button');close.className='note-close';close.textContent='×';close.title='Delete note';close.setAttribute('aria-label','Delete note');close.onclick=e=>{e.stopPropagation();requestDelete(n)};top.append(close);
el.append(top);const content=document.createElement('div');content.className='note-content';content.textContent=n.text;content.contentEditable=tool==='select'&&selected===n.id&&n.mode==='text';content.setAttribute('aria-label','Note text');content.spellcheck=true;content.hidden=n.mode==='draw';content.style.cssText=`font-family:${n.font};font-size:${n.size}px;font-weight:${n.bold?'bold':'normal'};font-style:${n.italic?'italic':'normal'};text-decoration:${n.underline?'underline':'none'};${n.highlight?'background:linear-gradient(transparent 0%,#fff49b99 0%);':''}`;content.oninput=()=>{n.text=content.innerText;save()};content.onpaste=e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,text)};el.append(content);
const canvas=document.createElement('canvas');canvas.width=476;canvas.height=428;canvas.hidden=n.mode!=='draw';canvas.setAttribute('aria-label','Drawing area');el.append(canvas);el.onclick=()=>{if(!suppressCanvasClick)clickNote(n)};top.onpointerdown=e=>beginDrag(e,n,el);top.onwheel=e=>{if(group(n).length>1){e.preventDefault();cycle(n,e.deltaY>0?1:-1)} };holder.append(el);paint(canvas,n);drawing(canvas,n);
}
$('#empty').hidden=state.notes.length>0;$('#note-count').textContent=state.notes.length?`${state.notes.length} ${state.notes.length===1?'thought':'thoughts'} · Room for more`:'A clear canvas. A fresh start.';syncEditor();renderEdges();}
function cycle(n,d){const g=group(n);if(g.length<2)return;const target=d>0?g[0]:g.at(-2);state.notes=state.notes.filter(x=>x.id!==target.id);state.notes.push(target);selected=target.id;render();save()}
function beginDrag(e,n,el){
 if(e.target.closest('button')||tool!=='select'||e.button!==0)return;
 e.preventDefault();const p=point(e);
 const multiple=areaSelection.has(n.id)&&areaSelection.size>1;
 const g=multiple?state.notes.filter(x=>areaSelection.has(x.id)):group(n);
 const orig=g.map(x=>({n:x,x:x.x,y:x.y}));let moved=false;el.setPointerCapture(e.pointerId);
 const move=ev=>{const q=point(ev);let dx=q.x-p.x,dy=q.y-p.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(!moved)return;
  dx=Math.max(-Math.min(...orig.map(o=>o.x)),Math.min(3750-Math.max(...orig.map(o=>o.x)),dx));
  dy=Math.max(-Math.min(...orig.map(o=>o.y)),Math.min(2740-Math.max(...orig.map(o=>o.y)),dy));
  for(const o of orig){o.n.x=o.x+dx;o.n.y=o.y+dy;const node=document.getElementById(o.n.id);if(node){node.style.left=o.n.x+'px';node.style.top=o.n.y+'px';}}
  queueEdgePreview();
 };
 const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);
  if(moved){if(!multiple){const target=visibleNotes().find(t=>!g.includes(t)&&Math.abs(t.x-n.x)<125&&Math.abs(t.y-n.y)<140);
   if(target){const all=[...group(target),...g],id=target.stack||crypto.randomUUID();all.forEach(x=>{x.stack=id;x.x=target.x;x.y=target.y});toast('Stacked. Scroll its top edge to flip through.');}
   areaSelection.clear();selected=n.id;
  }
  suppressCanvasClick=true;setTimeout(()=>suppressCanvasClick=false,0);render();save();}
 };
 el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
}
function connectionSlot(note,edge){
 const ids=new Set(group(note).map(n=>n.id));
 const attached=state.edges.filter(e=>(ids.has(e.a)||ids.has(e.b))&&!(ids.has(e.a)&&ids.has(e.b)));
 const index=attached.findIndex(e=>e.id===edge.id);
 return index<0?.5:(index+1)/(attached.length+1);
}
function connectionCrowding(a,b,paths,scale=1){
 let penalty=0;const horizontal=Math.abs(a.y-b.y)<.01,vertical=Math.abs(a.x-b.x)<.01;
 for(const path of paths)for(let i=1;i<path.length;i++){
  const c=path[i-1],d=path[i];
  if(horizontal&&Math.abs(c.y-d.y)<.01&&Math.abs(a.y-c.y)<7/scale){
   const overlap=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x));if(overlap>0)penalty+=overlap*3+45/scale;
  }else if(vertical&&Math.abs(c.x-d.x)<.01&&Math.abs(a.x-c.x)<7/scale){
   const overlap=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y));if(overlap>0)penalty+=overlap*3+45/scale;
  }else{
   const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
   if(Math.abs(den)<.001)continue;
   const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
   if(t>=0&&t<=1&&u>=0&&u<=1)penalty+=80/scale;
  }
 }
 return penalty;
}
function routeConnection(a,b,notes,scale=1,aSlot=.5,bSlot=.5,usedPaths=[]){
 const gap=16/scale,tipGap=5/scale;
 const boxes=notes.map(n=>({l:n.x-gap,r:n.x+240+gap,t:n.y-gap,b:n.y+250+gap}));
 const inside=(x,y)=>boxes.some(r=>x>r.l+.01&&x<r.r-.01&&y>r.t+.01&&y<r.b-.01);
 const clear=(p,q)=>!boxes.some(r=>p.x===q.x?p.x>r.l+.01&&p.x<r.r-.01&&Math.max(p.y,q.y)>r.t+.01&&Math.min(p.y,q.y)<r.b-.01:p.y>r.t+.01&&p.y<r.b-.01&&Math.max(p.x,q.x)>r.l+.01&&Math.min(p.x,q.x)<r.r-.01);
 const ports=(n,slot)=>[
  {x:n.x-gap,y:n.y+25+200*slot,tip:{x:n.x-tipGap,y:n.y+25+200*slot}},
  {x:n.x+240+gap,y:n.y+25+200*slot,tip:{x:n.x+240+tipGap,y:n.y+25+200*slot}},
  {x:n.x+24+192*slot,y:n.y-gap,tip:{x:n.x+24+192*slot,y:n.y-tipGap}},
  {x:n.x+24+192*slot,y:n.y+250+gap,tip:{x:n.x+24+192*slot,y:n.y+250+tipGap}}
 ].filter(p=>!inside(p.x,p.y));
 const starts=ports(a,aSlot),ends=ports(b,bSlot);if(!starts.length||!ends.length)return [];
 const xs=[...new Set([...boxes.flatMap(r=>[r.l,r.r]),...starts.map(p=>p.x),...ends.map(p=>p.x)])].sort((a,b)=>a-b);
 const ys=[...new Set([...boxes.flatMap(r=>[r.t,r.b]),...starts.map(p=>p.y),...ends.map(p=>p.y)])].sort((a,b)=>a-b);
 const width=xs.length,id=p=>ys.indexOf(p.y)*width+xs.indexOf(p.x),point=i=>({x:xs[i%width],y:ys[Math.floor(i/width)]});
 const targets=new Map(ends.map(p=>[id(p),p])),origins=new Map(starts.map(p=>[id(p),p]));
 const dist=new Map(),prev=new Map(),heap=[];
 function push(item){heap.push(item);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(heap[parent].cost<=item.cost)break;heap[i]=heap[parent];i=parent;}heap[i]=item;}
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].cost<heap[child].cost)child++;if(heap[child].cost>=last.cost)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
 for(const p of starts){dist.set(id(p),0);push({id:id(p),cost:0});}
 while(heap.length){const current=pop();if(current.cost!==dist.get(current.id))continue;
  if(targets.has(current.id)){const path=[];let k=current.id;while(k!==undefined){path.push(point(k));const next=prev.get(k);if(next===undefined){path.push(origins.get(k).tip);break;}k=next;}path.reverse();path.push(targets.get(current.id).tip);return path;}
  const p=point(current.id),x=current.id%width,y=Math.floor(current.id/width);
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=width||ny>=ys.length)continue;
   const key=ny*width+nx,q=point(key);if(inside(q.x,q.y)||!clear(p,q))continue;
   const cost=current.cost+Math.abs(q.x-p.x)+Math.abs(q.y-p.y)+connectionCrowding(p,q,usedPaths,scale);
   if(cost<(dist.get(key)??Infinity)){dist.set(key,cost);prev.set(key,current.id);push({id:key,cost});}
  }
 }
 return [];
}
function curvedConnectionPath(points,scale=1,notes=[],usedPaths=[]){
 if(!points.length)return '';
 const boxes=notes.map(n=>({l:n.x+1,r:n.x+239,t:n.y+1,b:n.y+249}));
 // Exact segment/rectangle intersection also handles diagonal shortcuts.
 const clear=(a,b)=>!boxes.some(rect=>{
  let low=0,high=1;
  for(const [v,d,min,max] of [[a.x,b.x-a.x,rect.l,rect.r],[a.y,b.y-a.y,rect.t,rect.b]]){
   if(Math.abs(d)<1e-9){if(v<min||v>max)return false;}
   else{let u=(min-v)/d,w=(max-v)/d;if(u>w)[u,w]=[w,u];low=Math.max(low,u);high=Math.min(high,w);if(low>high)return false;}
  }
  return true;
 });
 const route=[points[0]];
 // Keep endpoint stems for correctly aimed arrowheads; bypass excess grid bends.
 for(let i=1;i<points.length-1;){route.push(points[i]);let next=i+1;
  for(let j=points.length-2;j>i+1;j--)if(clear(points[i],points[j])&&connectionCrowding(points[i],points[j],usedPaths,scale)<=80/scale){next=j;break;}
  i=next;
 }
 if(points.length>1)route.push(points.at(-1));
 let d='M '+route[0].x+' '+route[0].y;
 for(let i=1;i<route.length-1;i++){
  const a=route[i-1],b=route[i],c=route[i+1];
  const incoming=Math.hypot(b.x-a.x,b.y-a.y),outgoing=Math.hypot(c.x-b.x,c.y-b.y);
  if(!incoming||!outgoing)continue;
  let radius=Math.min(240/scale,incoming/2,outgoing/2),entry,exit;
  for(let attempt=0;attempt<16;attempt++){
   entry={x:b.x+(a.x-b.x)*radius/incoming,y:b.y+(a.y-b.y)*radius/incoming};
   exit={x:b.x+(c.x-b.x)*radius/outgoing,y:b.y+(c.y-b.y)*radius/outgoing};
   let previous=entry,safe=true;
   for(let k=1;k<=40;k++){const t=k/40,u=1-t,p={x:u*u*entry.x+2*u*t*b.x+t*t*exit.x,y:u*u*entry.y+2*u*t*b.y+t*t*exit.y};if(!clear(previous,p)){safe=false;break;}previous=p;}
   if(safe)break;radius*=.7;
  }
  d+=' L '+entry.x+' '+entry.y+' Q '+b.x+' '+b.y+' '+exit.x+' '+exit.y;
 }
 const last=route.at(-1);return d+' L '+last.x+' '+last.y;
}
function straightConnection(a,b,scale=1,aSlot=.5,bSlot=.5){
 const dx=b.x-a.x,dy=b.y-a.y;if(!dx&&!dy)return [];
 const gap=5/scale;
 if(Math.abs(dx)/240>=Math.abs(dy)/250){const right=dx>0;
  return [{x:a.x+(right?240+gap:-gap),y:a.y+25+200*aSlot},{x:b.x+(right?-gap:240+gap),y:b.y+25+200*bSlot}];
 }
 const down=dy>0;
 return [{x:a.x+24+192*aSlot,y:a.y+(down?250+gap:-gap)},{x:b.x+24+192*bSlot,y:b.y+(down?-gap:250+gap)}];
}
function arcHitsNotes(start,control,end,notes){
 const at=(t,axis)=>(1-t)*(1-t)*start[axis]+2*(1-t)*t*control[axis]+t*t*end[axis];
 return notes.some(n=>{
  const bounds={x:[n.x-2,n.x+242],y:[n.y-2,n.y+252]},times=[0,1];
  for(const axis of ['x','y'])for(const boundary of bounds[axis]){
   const a=start[axis]-2*control[axis]+end[axis],b=2*(control[axis]-start[axis]),c=start[axis]-boundary;
   if(Math.abs(a)<1e-9){if(Math.abs(b)>1e-9){const t=-c/b;if(t>0&&t<1)times.push(t);}}
   else{const disc=b*b-4*a*c;if(disc>=0)for(const t of [(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)])if(t>0&&t<1)times.push(t);}
  }
  times.sort((a,b)=>a-b);
  for(let i=1;i<times.length;i++){const t=(times[i-1]+times[i])/2,x=at(t,'x'),y=at(t,'y');if(x>bounds.x[0]&&x<bounds.x[1]&&y>bounds.y[0]&&y<bounds.y[1])return true;}
  return false;
 });
}
function arcConnectionPath(points,scale=1,notes=[],layoutNotes=notes){
 const start=points[0],end=points.at(-1),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
 if(!length)return null;
 const bend=Math.min(200/scale,Math.max(45/scale,length*.3));
 const mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
 let towardCenter=0;
 for(const n of layoutNotes){const x=n.x+120-mid.x,y=n.y+125-mid.y;towardCenter+=(x*dy-y*dx)/length/(x*x+y*y+1);}
 // Bulge away from the group's center, regardless of arrow direction.
 const outward=Math.abs(towardCenter)>1e-8?(towardCenter>0?-1:1):(dx>0||(!dx&&dy>0)?1:-1);
 const candidates=[1,1.5,2,3,4,6,-1,-1.5,-2,-3,-4,-6].map(v=>v*outward);
 for(const multiplier of candidates){
  const control={x:(start.x+end.x)/2+dy/length*bend*multiplier,y:(start.y+end.y)/2-dx/length*bend*multiplier};
  if(arcHitsNotes(start,control,end,notes))continue;
  return {d:'M '+start.x+' '+start.y+' Q '+control.x+' '+control.y+' '+end.x+' '+end.y,control};
 }
 return null;
}
function renderEdges(fast=false){
 if(!fast&&edgeFrame){cancelAnimationFrame(edgeFrame);edgeFrame=0;}
 const svg=$('#connections');svg.replaceChildren();const ns='http://www.w3.org/2000/svg',obstacles=visibleNotes(),usedPaths=[];
 for(const e of state.edges){const a=noteById(e.a),b=noteById(e.b);if(!a||!b||(a.stack&&a.stack===b.stack))continue;
  const aSlot=connectionSlot(a,e),bSlot=connectionSlot(b,e);
  let points;
  const cached=edgeRoutes.get(e.id);
  if(state.connectionStyle==='arc'){points=straightConnection(a,b,zoom,aSlot,bSlot);}
  else if(fast&&cached&&state.connectionStyle!=='original'){
   points=cached.points.map((p,i)=>{const start=i<2,end=i>=cached.points.length-2;return {x:p.x+(start?a.x-cached.ax:end?b.x-cached.bx:0),y:p.y+(start?a.y-cached.ay:end?b.y-cached.by:0)}});
  }else points=state.connectionStyle==='original'||fast?straightConnection(a,b,zoom,aSlot,bSlot):routeConnection(a,b,obstacles,zoom,aSlot,bSlot,usedPaths);
  if(points.length<2)continue;
  if(!fast)edgeRoutes.set(e.id,{points,ax:a.x,ay:a.y,bx:b.x,by:b.y});
  const endpointIds=new Set([...group(a),...group(b)].map(n=>n.id));
  const neighbors=id=>new Set(state.edges.filter(edge=>edge.a===id||edge.b===id).map(edge=>edge.a===id?edge.b:edge.a));
  const aNeighbors=neighbors(a.id),bNeighbors=neighbors(b.id);
  const others=obstacles.filter(n=>!endpointIds.has(n.id));
  const shared=others.filter(n=>aNeighbors.has(n.id)&&bNeighbors.has(n.id));
  const arc=state.connectionStyle==='arc'?arcConnectionPath(points,zoom,obstacles,shared.length?shared:others):null;
  if(state.connectionStyle==='arc'&&!arc){points=routeConnection(a,b,obstacles,zoom,aSlot,bSlot);if(points.length<2)continue;}
  const d=arc?arc.d:curvedConnectionPath(points,zoom,fast&&state.connectionStyle!=='arc'?[]:obstacles,fast?[]:usedPaths);usedPaths.push(points);
  const line=document.createElementNS(ns,'path');
  const remove=ev=>{ev.stopPropagation();state.edges=state.edges.filter(x=>x.id!==e.id);renderEdges();save();toast('Connection removed')};
  for(const [k,v] of Object.entries({d,stroke:e.color,'stroke-width':3.5/zoom,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none'}))line.setAttribute(k,v);
  svg.append(line);
  const hit=document.createElementNS(ns,'path');for(const [k,v] of Object.entries({d,stroke:'transparent','stroke-width':16/zoom,fill:'none'}))hit.setAttribute(k,v);hit.style.pointerEvents='stroke';hit.style.cursor='pointer';hit.onclick=remove;svg.append(hit);
  if(e.type==='arrow'){
   const tip=points.at(-1),before=arc?arc.control:points.at(-2),length=Math.hypot(tip.x-before.x,tip.y-before.y),ux=(tip.x-before.x)/length,uy=(tip.y-before.y)/length,size=17/zoom,half=8/zoom;
   const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M '+tip.x+' '+tip.y+' L '+(tip.x-ux*size-uy*half)+' '+(tip.y-uy*size+ux*half)+' L '+(tip.x-ux*size+uy*half)+' '+(tip.y-uy*size-ux*half)+' Z');
   arrow.setAttribute('fill',e.color);arrow.setAttribute('stroke',state.dark?'#1b201d':'#f8f9f7');arrow.setAttribute('stroke-width',1.5/zoom);arrow.style.pointerEvents='all';arrow.style.cursor='pointer';arrow.onclick=remove;svg.append(arrow);
  }
 }
}
function syncEditor(){const n=current();$('#editor').hidden=!n||tool!=='select';if(!n)return;$('#text-controls').hidden=n.mode==='draw';$('#draw-controls').hidden=n.mode!=='draw';$('#text-mode').classList.toggle('chosen',n.mode==='text');$('#draw-mode').classList.toggle('chosen',n.mode==='draw');$('#font').value=n.font;$('#size').value=n.size;$('#ink').value=n.ink;$('#unstack').hidden=group(n).length<2;$$('[data-format]').forEach(b=>b.classList.toggle('chosen',!!n[b.dataset.format]));}
$('#text-mode').onclick=()=>{if(current()){current().mode='text';render();save()}};$('#draw-mode').onclick=()=>{if(current()){current().mode='draw';render();save()}};
for(const [id,prop]of[['font','font'],['size','size'],['ink','ink']])$('#'+id).onchange=e=>{if(current()){current()[prop]=id==='size'?Number(e.target.value):e.target.value;render();save()}};
$$('[data-format]').forEach(b=>b.onclick=()=>{const n=current();if(n){n[b.dataset.format]=!n[b.dataset.format];render();save()}});
let pendingDelete=null;
function requestDelete(n){if(!n||$('#delete-dialog').open)return;pendingDelete=n.id;$('#delete-dialog').showModal();$('#cancel-delete').focus()}
$('#delete').onclick=()=>requestDelete(current());
$('#cancel-delete').onclick=()=>$('#delete-dialog').close();
$('#delete-dialog').addEventListener('close',()=>{pendingDelete=null});
function deleteNote(id){if(!id)return;state.notes=state.notes.filter(n=>n.id!==id);state.edges=state.edges.filter(e=>e.a!==id&&e.b!==id);if(selected===id)selected=null;render();save();toast('Note deleted')}
$('#confirm-delete').onclick=()=>{const id=pendingDelete;pendingDelete=null;$('#delete-dialog').close();deleteNote(id)};
function separateStack(n){
 const members=group(n);if(members.length<2)return;
 const ordered=[n,...members.filter(item=>item!==n)];
 const occupied=state.notes.filter(item=>!members.includes(item));
 const positions=[];
 for(let y=0;y<=2740;y+=280)for(let x=0;x<=3750;x+=270)positions.push({x,y});
 positions.sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));
 for(const item of ordered){
  const spot=positions.find(p=>!occupied.some(other=>Math.abs(other.x-p.x)<255&&Math.abs(other.y-p.y)<265));
  if(!spot){toast('There is not enough room to separate this stack. Move some notes first.');return;}
  occupied.push({...item,x:spot.x,y:spot.y});
 }
 const placed=occupied.slice(-ordered.length);
 ordered.forEach((item,i)=>{item.stack=null;item.x=placed[i].x;item.y=placed[i].y});
 selected=n.id;render();save();toast('Stack separated. Each note can now move on its own.');
}
$('#unstack').onclick=()=>{const n=current();if(n)separateStack(n)};
function paint(canvas,n){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);for(const s of n.strokes||[]){ctx.save();ctx.scale(2,2);ctx.globalCompositeOperation=s.brush==='eraser'?'destination-out':'source-over';ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.globalAlpha=s.brush==='marker'?.32:s.brush==='pencil'?.65:1;ctx.lineWidth=s.width*(s.brush==='marker'?3:1);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(s.points.length===1){ctx.arc(s.points[0].x,s.points[0].y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill()}else ctx.stroke();ctx.restore()}}
function drawing(canvas,n){canvas.onpointerdown=e=>{if(tool!=='select'||selected!==n.id)return;e.stopPropagation();e.preventDefault();canvas.setPointerCapture(e.pointerId);const get=ev=>{const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*238/r.width,y:(ev.clientY-r.top)*214/r.height}};const stroke={brush:$('#brush').value,color:$('#draw-color').value,width:Number($('#thickness').value),points:[get(e)]};n.strokes.push(stroke);paint(canvas,n);canvas.onpointermove=ev=>{stroke.points.push(get(ev));paint(canvas,n)};const end=()=>{canvas.onpointermove=null;canvas.onpointerup=null;canvas.onpointercancel=null;save()};canvas.onpointerup=end;canvas.onpointercancel=end}}
$('#clear-drawing').onclick=()=>{if(current()){current().strokes=[];render();save()}};
$('#viewport').onclick=e=>{if(suppressCanvasClick||tool==='board-draw')return;if(e.target.closest('.note')||e.target.closest('line'))return;if(tool==='note'){const p=point(e);addNote(p.x,p.y)}else{areaSelection.clear();selected=null;render()}};$('#viewport').ondblclick=e=>{if(tool==='board-draw'||e.target.closest('.note'))return;const p=point(e);addNote(p.x,p.y)};
const stopWords=new Set('a an the and or to of in on is it i my me we you your for with that this are was be have do but as at so from just can will want need some'.split(' '));
function normalizeWord(word){
 if(word.length>4&&word.endsWith('ies'))return word.slice(0,-3)+'y';
 if(word.length>4&&/(ches|shes|xes|zes|sses)$/.test(word))return word.slice(0,-2);
 if(word.length>3&&word.endsWith('s')&&!/(ss|us|is)$/.test(word))return word.slice(0,-1);
 if(word.length>5&&/(ing|ed)$/.test(word)){let root=word.replace(/(ing|ed)$/,'');if(/([^aeiou])\1$/.test(root))root=root.slice(0,-1);return root.replace(/e$/,'');}
 return word.length>3?word.replace(/e$/,''):word;
}
function keywords(text){return new Set((String(text||'').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).filter(w=>!stopWords.has(w)).map(w=>normalizeWord(w)).map(w=>w.length>3?w.replace(/e$/,''):w))}
function sortNotes(){
 if(state.notes.length<2){toast('Add at least two notes to find connections.');return;}
 const terms=new Map(state.notes.map(n=>[n.id,keywords(n.text)]));
 const pairs=[];
 for(let i=0;i<state.notes.length;i++)for(let j=i+1;j<state.notes.length;j++){
  const a=state.notes[i],b=state.notes[j];
  if([...terms.get(a.id)].some(word=>terms.get(b.id).has(word)))pairs.push([a,b]);
 }
 if(!pairs.length){toast('No shared keywords yet. Try “buy apples” and “apple pie”.');return;}
 // Spread matched notes and their stack members into free spaces, so links are visible.
 const matched=new Set(pairs.flat().map(n=>n.id));
 const moving=state.notes.filter(n=>matched.has(n.id)||group(n).some(m=>matched.has(m.id)));
 const occupied=state.notes.filter(n=>!moving.includes(n)).map(n=>({x:n.x,y:n.y}));
 const positions=[];
 for(let y=130;y<=2650;y+=310)for(let x=140;x<=3650;x+=310)positions.push({x,y});
 const placements=[];
 for(const n of moving){const pos=positions.find(p=>!occupied.some(o=>Math.abs(p.x-o.x)<270&&Math.abs(p.y-o.y)<280));
  if(!pos){toast('Not enough canvas space to spread these notes. Separate or move some notes first.');return;}
  placements.push(pos);occupied.push(pos);
 }
 moving.forEach((n,i)=>{n.stack=null;n.x=placements[i].x;n.y=placements[i].y});
 let added=0;
 for(const [a,b] of pairs){
  const existing=state.edges.find(e=>(e.a===a.id&&e.b===b.id)||(e.a===b.id&&e.b===a.id));
  if(existing){existing.type=connectionType;continue;}
  state.edges.push({id:crypto.randomUUID(),a:a.id,b:b.id,type:connectionType,color:state.dark?'#b5cba5':'#526847'});added++;
 }
 selected=null;setTool('select');render();save();
 $('#viewport').scrollLeft=0;$('#viewport').scrollTop=0;
 toast(pairs.length+' related '+(pairs.length===1?'pair':'pairs')+' connected. Matched notes are spread apart.');
}
$('#sort').onclick=sortNotes;
function setZoom(value,anchor){
 const viewport=$('#viewport'),rect=viewport.getBoundingClientRect();
 const x=anchor?anchor.x-rect.left:viewport.clientWidth/2,y=anchor?anchor.y-rect.top:viewport.clientHeight/2;
 const worldX=(viewport.scrollLeft+x)/zoom,worldY=(viewport.scrollTop+y)/zoom;
 zoom=Math.max(.5,Math.min(1.5,value));$('#world').style.transform='scale('+zoom+')';
 $('#world-size').style.width=4000*zoom+'px';$('#world-size').style.height=3000*zoom+'px';
 viewport.scrollLeft=worldX*zoom-x;viewport.scrollTop=worldY*zoom-y;
 $('#zoom-reset').textContent=Math.round(zoom*100)+'%';queueEdgePreview();clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>renderEdges(),180);
}
$('#zoom-in').onclick=()=>setZoom(zoom+.1);$('#zoom-out').onclick=()=>setZoom(zoom-.1);$('#zoom-reset').onclick=()=>setZoom(1);
$('#viewport').addEventListener('wheel',e=>{
 if(e.defaultPrevented)return;e.preventDefault();
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?300:1);
 setZoom(zoom*Math.exp(-Math.max(-150,Math.min(150,delta))*.002),{x:e.clientX,y:e.clientY});
},{passive:false});
$('#viewport').addEventListener('contextmenu',e=>e.preventDefault());
$('#viewport').addEventListener('pointerdown',e=>{
 if(e.button!==2)return;e.preventDefault();e.stopImmediatePropagation();
 const viewport=$('#viewport'),x=e.clientX,y=e.clientY,left=viewport.scrollLeft,top=viewport.scrollTop;
 viewport.setPointerCapture(e.pointerId);document.body.classList.add('panning');
 const move=ev=>{viewport.scrollLeft=left+x-ev.clientX;viewport.scrollTop=top+y-ev.clientY;};
 const end=()=>{viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',end);viewport.removeEventListener('pointercancel',end);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);document.body.classList.remove('panning');};
 viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
},true);
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();document.addEventListener('keydown',e=>{if(e.target.closest('input,select,[contenteditable=true]')||$('dialog[open]'))return;if(e.key==='Delete'&&areaSelection.size){e.preventDefault();const ids=new Set(areaSelection);state.notes=state.notes.filter(n=>!ids.has(n.id));state.edges=state.edges.filter(edge=>!ids.has(edge.a)&&!ids.has(edge.b));areaSelection.clear();selected=null;render();save();toast('Selected notes deleted');return;}if(e.key==='Delete'&&current()){e.preventDefault();deleteNote(current().id);return;}if(e.key.toLowerCase()==='n'){e.preventDefault();addNote()}if(e.key.toLowerCase()==='v')setTool('select');if(e.key==='Escape'){areaSelection.clear();selected=null;setTool('select');render()}});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'add_thought',title:'Add a thought',description:'Create a sticky note on this canvas and save it on this device.',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.text!=='string'||input.text.length>20000)throw new Error('Provide text up to 20,000 characters.');const n=addNote(undefined,undefined,input.text);flushSave();return{id:n.id,text:n.text}}})).catch(()=>{})}catch{}}
render();

function notesInArea(start,end){
 const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
 return new Set(visibleNotes().filter(n=>n.x<right&&n.x+240>left&&n.y<bottom&&n.y+250>top).flatMap(n=>group(n).map(item=>item.id)));
}
$('#viewport').addEventListener('pointerdown',e=>{
 if(tool!=='select'||e.button!==0||e.target.closest('.note,svg path,button,input'))return;
 const viewport=$('#viewport'),start=point(e),previous=new Set(areaSelection),oldSelected=selected;
 let box=null;
 viewport.setPointerCapture(e.pointerId);
 const move=ev=>{const end=point(ev);if(!box&&Math.hypot(end.x-start.x,end.y-start.y)*zoom<5)return;
  if(!box){document.activeElement?.blur();box=document.createElement('div');box.className='selection-area';$('#world').append(box);}
  box.style.left=Math.min(start.x,end.x)+'px';box.style.top=Math.min(start.y,end.y)+'px';box.style.width=Math.abs(end.x-start.x)+'px';box.style.height=Math.abs(end.y-start.y)+'px';
  areaSelection=notesInArea(start,end);selected=null;render();
 };
 const end=ev=>{viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',end);viewport.removeEventListener('pointercancel',end);
  if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
  if(box){box.remove();suppressCanvasClick=true;setTimeout(()=>suppressCanvasClick=false,0);
   if(ev.type==='pointercancel'){areaSelection=previous;selected=oldSelected;}
   else if(areaSelection.size===1){selected=[...areaSelection][0];areaSelection.clear();}
   render();
  }
 };
 viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
});

$('#connection-style').value=['rounded','original','arc'].includes(state.connectionStyle)?state.connectionStyle:'rounded';
$('#connection-style').onchange=e=>{state.connectionStyle=e.target.value;renderEdges();save()};

// Store board strokes separately from each sticky note's drawing.
if(!Array.isArray(state.boardStrokes))state.boardStrokes=[];
function renderBoardDrawing(){
 const canvas=$('#board-drawing'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 for(const stroke of state.boardStrokes){
  ctx.save();ctx.globalCompositeOperation=stroke.brush==='eraser'?'destination-out':'source-over';
  ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineWidth=stroke.width;
  ctx.globalAlpha=stroke.brush==='marker'?.35:1;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  stroke.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  if(stroke.points.length===1){const p=stroke.points[0];ctx.arc(p.x,p.y,stroke.width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();ctx.restore();
 }
 $('#board-undo').disabled=state.boardStrokes.length===0;
}
$('#board-drawing').addEventListener('pointerdown',e=>{
 if(tool!=='board-draw'||e.button!==0)return;e.preventDefault();e.stopPropagation();
 const canvas=e.currentTarget,brush=$('#board-brush').value;
 const stroke={brush,color:$('#board-ink').value,width:Number($('#board-width').value)*(brush==='marker'?3:brush==='eraser'?2:1),points:[point(e)]};
 state.boardStrokes.push(stroke);canvas.setPointerCapture(e.pointerId);renderBoardDrawing();
 const move=ev=>{const p=point(ev),last=stroke.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)<.8)return;stroke.points.push(p);renderBoardDrawing();};
 const end=ev=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(ev.type==='pointercancel'){state.boardStrokes=state.boardStrokes.filter(s=>s!==stroke);renderBoardDrawing();}save();};
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
});
$('#board-undo').onclick=()=>{state.boardStrokes.pop();renderBoardDrawing();save()};
$('#board-done').onclick=()=>{setTool('select');render()};
if(state.dark)$('#board-ink').value='#b5cba5';
renderBoardDrawing();

function positionEditor(x,y){
 const panel=$('#editor'),space=$('#workspace');
 const pos={x:Math.max(8,Math.min(x,space.clientWidth-panel.offsetWidth-8)),y:Math.max(8,Math.min(y,space.clientHeight-panel.offsetHeight-8))};
 panel.style.transform='none';panel.style.left=pos.x+'px';panel.style.top=pos.y+'px';return pos;
}
$('#editor-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0)return;e.preventDefault();
 const handle=e.currentTarget,panel=$('#editor'),rect=panel.getBoundingClientRect(),space=$('#workspace').getBoundingClientRect();
 const left=rect.left-space.left,top=rect.top-space.top,x=e.clientX,y=e.clientY,previous=state.editorPosition;
 handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
 const move=ev=>{state.editorPosition=positionEditor(left+ev.clientX-x,top+ev.clientY-y);};
 const end=ev=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.classList.remove('dragging');if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
  if(ev.type==='pointercancel'){state.editorPosition=previous;if(previous)positionEditor(previous.x,previous.y);else{panel.style.left='';panel.style.top='';panel.style.transform='';}}
  save();
 };
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
});
function resetEditorPosition(){delete state.editorPosition;const panel=$('#editor');panel.style.left='';panel.style.top='';panel.style.transform='';save()}
$('#editor-handle').ondblclick=resetEditorPosition;
$('#editor-handle').addEventListener('keydown',e=>{
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(e.key==='Home'){e.preventDefault();resetEditorPosition();return;}if(!directions[e.key])return;e.preventDefault();e.stopPropagation();
 const r=$('#editor').getBoundingClientRect(),parent=$('#workspace').getBoundingClientRect(),step=e.shiftKey?30:10,d=directions[e.key];
 state.editorPosition=positionEditor(r.left-parent.left+d[0]*step,r.top-parent.top+d[1]*step);save();
});
new ResizeObserver(()=>{if(!$('#editor').hidden&&state.editorPosition)positionEditor(state.editorPosition.x,state.editorPosition.y)}).observe($('#editor'));
window.addEventListener('resize',()=>{if(!$('#editor').hidden&&state.editorPosition)positionEditor(state.editorPosition.x,state.editorPosition.y)});
