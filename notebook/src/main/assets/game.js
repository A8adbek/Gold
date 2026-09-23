(() => {
  'use strict';
  const canvas=document.getElementById('world'),ctx=canvas.getContext('2d',{alpha:false});
  const $=id=>document.getElementById(id),flight=new NotebookFlight();
  let w=0,h=0,focal=0,state='menu',last=0,renderAt=0,phase=0,drag=null,toastUntil=0,bank=0;
  let best=0,economy=false;
  try{best=Number(localStorage.getItem('notebook-best'))||0;economy=localStorage.getItem('notebook-eco')==='1';}catch(e){}
  const keys=new Set();
  function resize(){w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,economy?1:1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);focal=Math.min(w*.98,h*.8);}
  function quality(){ $('quality').textContent='TEJAMKOR: '+(economy?'YOQIQ':'O‘CHIQ');resize(); }
  $('quality').onclick=()=>{economy=!economy;try{localStorage.setItem('notebook-eco',economy?'1':'0');}catch(e){}quality();};
  function project(x,y,z){const s=focal/(z+4);return {x:w*.5+x*s,y:h*.42-(y-.65)*s,s};}
  function path(points,fill,stroke='#3b3b3b',width=1){ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function line(a,b,color='#aaa',width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  const section=[[-4,-3],[-4,.9],[-3.25,2.5],[-1.7,3.25],[0,3.45],[1.7,3.25],[3.25,2.5],[4,.9],[4,-3]];
  function rim(z){return section.map(([x,y])=>project(x,y,z));}
  function tunnel(){
    ctx.fillStyle='#eeedeb';ctx.fillRect(0,0,w,h);
    const near=rim(.05),far=rim(115);
    const shades=['#c9c8c5','#dddcda','#e8e7e4','#f1f0ed','#f5f4f1','#efeeeb','#dfdedb','#c9c8c5'];
    for(let i=0;i<8;i++)path([near[i],near[i+1],far[i+1],far[i]],shades[i],'#999894',.6);
    path([near[0],near[8],far[8],far[0]],'#deddd9','#999',1);
    // Recycled ruled-paper seams: no texture downloads or unbounded world meshes.
    const offset=phase%4;
    for(let z=112-offset;z>.15;z-=4){
      const r=rim(z);ctx.globalAlpha=Math.min(.6,1-z/125);
      for(let i=0;i<8;i++)line(r[i],r[i+1],'#858580',z<8?1:.65);
      line(r[0],r[8],'#a5a49f',.7);
      const p=project(-3.98,.1,z),rad=Math.max(.4,p.s*.09);
      ctx.fillStyle='#666662';ctx.beginPath();ctx.ellipse(p.x,p.y,rad*.45,rad*1.3,0,0,Math.PI*2);ctx.fill();
    }ctx.globalAlpha=1;
    for(const x of [-2,-.65,.65,2])line(project(x,-3,.05),project(x,-3,115),'#c4c3be',.7);
    // A distant bright paper opening, with a small dark folded edge.
    path(rim(115),'#f8f7f4','#bcbab4',1);
  }
  function object(o){
    if(o.z<.2)return;
    const p=project(o.x*4,o.y*2.8,o.z),rx=o.rx*4*p.s,ry=o.ry*2.8*p.s;
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=Math.min(1,(115-o.z)/30);
    if(o.type==='ring'){
      ctx.rotate(-.15);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.strokeStyle='#393936';ctx.lineWidth=Math.max(2,p.s*.09);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,0,rx*.81,ry*.81,0,0,Math.PI*2);ctx.strokeStyle='#fafaf7';ctx.lineWidth=Math.max(1,p.s*.025);ctx.stroke();
    }else if(o.type==='clip'){
      line({x:0,y:-ry},{x:0,y:-p.s*(3.1-o.y*2.8)},'#52524f',Math.max(1,p.s*.02));
      path([{x:-rx,y:-ry*.55},{x:rx,y:-ry*.55},{x:rx*.8,y:ry},{x:-rx*.8,y:ry}],'#343432','#191919',1.5);
      for(const x of [-.48,.48]){ctx.strokeStyle='#93938e';ctx.lineWidth=Math.max(2,p.s*.045);ctx.beginPath();ctx.ellipse(x*rx,-ry*.6,rx*.28,ry*.65,0,0,Math.PI*2);ctx.stroke();}
      line({x:-rx*.7,y:ry*.8},{x:rx*.7,y:ry*.8},'#c6c5bf',1);
    }else if(o.type==='eraser'){
      path([{x:-rx,y:-ry},{x:rx*.7,y:-ry},{x:rx,y:-ry*.7},{x:rx,y:ry},{x:-rx,y:ry}],'#74746e','#2e2e2b',1.5);
      path([{x:-rx,y:-ry},{x:rx*.7,y:-ry},{x:rx,y:-ry*.7},{x:-rx*.7,y:-ry*.7}],'#bbb9b2','#353532',1);
      ctx.fillStyle='#dad8d0';ctx.fillRect(-rx,-ry*.2,rx*2,ry*.75);
      ctx.fillStyle='#454540';ctx.font=Math.max(5,ry*.32)+'px monospace';ctx.textAlign='center';ctx.fillText('ERASER',0,ry*.3);
    }else{
      path([{x:-rx,y:ry*.7},{x:-rx*.5,y:-ry},{x:rx*.4,y:-ry*.65},{x:rx,y:ry},{x:0,y:ry*.75}],'#a2a19b','#353532',1.5);
      path([{x:-rx*.5,y:-ry},{x:0,y:ry*.75},{x:rx*.4,y:-ry*.65}],'#efeee7','#55554f',1);
      line({x:-rx,y:ry*.7},{x:rx*.4,y:-ry*.65},'#55554f',1);
    }ctx.restore();
  }
  function plane(){
    const p=project(flight.x*4,flight.y*2.8,5),size=Math.min(w*.16,90);
    const shadow=project(flight.x*4,-2.95,5);
    ctx.fillStyle='#44444422';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,size*.85,size*.14,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(bank);
    const pt=(x,y)=>({x:x*size,y:y*size});
    path([pt(0,-.95),pt(-1.05,.35),pt(-.17,.18),pt(0,.76),pt(.2,.18),pt(1.05,.35)],'#faf9f4','#292926',1.4);
    path([pt(0,-.95),pt(-.17,.18),pt(0,.76)],'#b3b2ac','#494944',.8);
    path([pt(0,-.95),pt(.2,.18),pt(0,.76)],'#dddcd5','#494944',.8);
    line(pt(0,-.95),pt(-.67,.22),'#c5c4bd',.8);line(pt(0,-.95),pt(.68,.23),'#c5c4bd',.8);
    ctx.restore();
  }
  function hud(){ $('distance').textContent=Math.floor(flight.distance);$('rings').textContent=flight.rings;$('speed').textContent=Math.round(flight.speed)+' m/s';$('record').textContent='REKORD '+best+' m'; }
  function show(mode){
    state=mode;drag=null;keys.clear();$('overlay').hidden=false;$('pause').disabled=true;
    $('title').innerHTML=mode==='paused'?'Bir oz<br>tanaffus<span>Ⅱ</span>':'Yana bir<br>parvoz?<span>↗</span>';
    $('description').textContent=mode==='paused'?'Parvozingiz shu yerda kutib turadi.':'Qog‘oz bukildi. Sarguzasht tugamadi.';
    $('result').textContent=Math.floor(flight.distance)+' METR · '+flight.rings+' HALQA · REKORD '+best+' m';
    $('start').innerHTML=mode==='paused'?'DAVOM ETISH <span>↗</span>':'QAYTA UCHISH <span>↗</span>';
  }
  window.pauseGame=()=>{if(state==='playing')show('paused');};
  $('pause').onclick=window.pauseGame;
  $('start').onclick=()=>{if(state!=='paused'){flight.reset();phase=0;bank=0;}state='playing';last=0;$('overlay').hidden=true;$('pause').disabled=false;};
  function crash(){best=Math.max(best,Math.floor(flight.distance));try{localStorage.setItem('notebook-best',best);}catch(e){}show('dead');}
  canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:flight.tx,py:flight.ty};});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;flight.steer(drag.px+(e.clientX-drag.x)/(w*.42),drag.py-(e.clientY-drag.y)/(h*.38));});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();if(e.key==='Escape'||e.key===' '){window.pauseGame();return;}keys.add(e.key.toLowerCase());});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)window.pauseGame();last=0;});
  window.addEventListener('blur',window.pauseGame);window.addEventListener('resize',resize);
  function frame(t){
    requestAnimationFrame(frame);
    const dt=last?Math.min((t-last)/1000,.05):0;last=t;
    if(state==='playing'){
      const dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);
      const dy=(keys.has('arrowup')||keys.has('w')?1:0)-(keys.has('arrowdown')||keys.has('s')?1:0);
      if(dx||dy)flight.steer(flight.tx+dx*dt*1.1,flight.ty+dy*dt*1.1);
      flight.update(dt);phase+=flight.speed*dt;
      bank+=((flight.tx-flight.x)*.9-bank)*Math.min(1,dt*12);
      for(const event of flight.events.splice(0)){if(event==='crash')crash();else{$('toast').textContent='+1 HALQA';toastUntil=t+850;}}
    }
    if(t-renderAt<(economy?32:15))return;renderAt=t;
    tunnel();for(const o of [...flight.objects].sort((a,b)=>b.z-a.z))object(o);plane();hud();
    $('toast').style.opacity=t<toastUntil?'1':'0';
  }
  quality();hud();$('pause').disabled=true;requestAnimationFrame(frame);
})();
