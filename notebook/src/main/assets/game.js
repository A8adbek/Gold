(() => {
 'use strict';
 const {Flight,P,floorAt,roofAt,clamp}=NotebookPhysics;
 const audio=window.NotebookAudio;
 const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false});
 const flight=new Flight({obstacles:false,openWorld:true});
 let w=0,h=0,focal=0,state='menu',last=0,renderAt=0,drag=null,pull=null,resumeState='playing',toastUntil=0;
 let best=0,economy=false,sensitivity=1,invert=false,launchAngle=6;
 const keys=new Set();
 const camera={x:0,y:3.5,z:-1.2,yaw:0,pitch:0};
 try{best=Number(localStorage.getItem('notebook-best'))||0;economy=localStorage.getItem('notebook-eco')==='1';sensitivity=clamp(Number(localStorage.getItem('notebook-sensitivity'))||1,.5,1.5);invert=localStorage.getItem('notebook-invert')==='1';}catch(e){}
 function save(key,value){try{localStorage.setItem(key,String(value));}catch(e){}}
 function resize(){w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,economy?1:1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);focal=Math.min(w*.98,h*.82);}
 function settings(){ $('quality').textContent='TEJAMKOR REJIM: '+(economy?'YOQIQ':'O‘CHIQ');$('sensitivity').value=Math.round(sensitivity*100);$('sensitivity-value').textContent=sensitivity.toFixed(1)+'×';$('invert').checked=invert;resize();}
 $('quality').onclick=()=>{economy=!economy;save('notebook-eco',economy?'1':'0');settings();};
 $('audio-toggle').onclick=()=>{$('audio-toggle').textContent='OVOZ: '+(audio.toggle()?'YOQILGAN':'O‘CHIRILGAN');audio.unlock();};
 $('sensitivity').oninput=e=>{sensitivity=Number(e.target.value)/100;save('notebook-sensitivity',sensitivity);$('sensitivity-value').textContent=sensitivity.toFixed(1)+'×';};
 $('invert').onchange=e=>{invert=e.target.checked;save('notebook-invert',invert?'1':'0');};
 $('launch-angle').oninput=e=>{launchAngle=Number(e.target.value);$('angle').textContent='BURCHAK '+launchAngle+'°';};
 function view(p){
   const dx=p[0]-camera.x,dy=p[1]-camera.y,dz=p[2]-camera.z,c=Math.cos(camera.yaw),s=Math.sin(camera.yaw);
   const x=c*dx-s*dz,z=s*dx+c*dz,cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
   return [x,cp*dy-sp*z,sp*dy+cp*z];
 }
 function screen(p){return {x:w*.5+focal*p[0]/p[2],y:h*.43-focal*p[1]/p[2]};}
 function polygon(points,fill,stroke='#5a5953',width=.8){
   const v=points.map(view),clipped=[];
   for(let i=0;i<v.length;i++){
     const a=v[i],b=v[(i+1)%v.length],ai=a[2]>=.08,bi=b[2]>=.08;
     if(ai)clipped.push(a);
     if(ai!==bi){const t=(.08-a[2])/(b[2]-a[2]);clipped.push(a.map((x,j)=>x+(b[j]-x)*t));}
   }
   if(clipped.length<3)return;
   ctx.beginPath();clipped.map(screen).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
   if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
 }
 function line(a,b,color='#77766f',width=1){
   a=view(a);b=view(b);if(a[2]<.08&&b[2]<.08)return;
   if(a[2]<.08||b[2]<.08){const t=(.08-a[2])/(b[2]-a[2]),p=a.map((x,i)=>x+(b[i]-x)*t);if(a[2]<.08)a=p;else b=p;}
   a=screen(a);b=screen(b);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
 }
 const cross=[[-4.8,0],[-4.8,5.7],[-4.15,6.6],[-2.4,7.26],[0,7.5],[2.4,7.26],[4.15,6.6],[4.8,5.7],[4.8,0]];
 const shades=['#c8c7c0','#d5d4cd','#e3e2da','#eeede6','#eeede6','#e3e2da','#d5d4cd','#c8c7c0','#dcdbd3'];
 function rim(z){return cross.map(([x,y])=>[x,y+floorAt(z),z]);}
 function environment(){
   // Red Dune Valley: open sky, warm sand and sparse desert vegetation.
   const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#58b9db');sky.addColorStop(.48,'#b8e1df');sky.addColorStop(1,'#f7c47a');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
   const base=Math.floor(camera.z/4)*4;
   const mesaZ=base+92;
   polygon([[-120,2.6,mesaZ],[-86,4.2,mesaZ],[-55,3.5,mesaZ],[-30,4.8,mesaZ],[-5,3.1,mesaZ],[28,4.4,mesaZ],[57,3.2,mesaZ],[88,4.6,mesaZ],[120,2.6,mesaZ]],'#9b4335',null);
   for(let n=28;n>=0;n--){
     const z0=base+n*4,z1=z0+4,y0=floorAt(z0),y1=floorAt(z1);
     polygon([[-120,y0,z0],[120,y0,z0],[120,y1,z1],[-120,y1,z1]],n%3?'#c9653f':'#d87947','#b14d37',.35);
     polygon([[-120,y0+.02,z0],[-3.2,y0+.02,z0],[ -3.0,y1+.02,z1],[-120,y1+.02,z1]],n%2?'#a94c36':'#b65338',null);
     polygon([[3.1,y0+.02,z0],[120,y0+.02,z0],[120,y1+.02,z1],[3.0,y1+.02,z1]],n%2?'#b65338':'#a94c36',null);
     const sway=Math.sin(z0*.31)*.16;
     for(const x of [-7.4+Math.sin(z0)*.8,6.9+Math.cos(z0*.7)*.9]){
       const gy=floorAt(z0)+.03;line([x,gy,z0],[x+sway,gy+.35,z0],'#4e7c43',1.7);line([x,gy+.16,z0],[x-.14,gy+.27,z0],'#668c45',1);line([x,gy+.22,z0],[x+.15,gy+.32,z0],'#668c45',1);
     }
     if(n%5===1){
       const x=-5.8+((n*1.73)%2.4),gy=floorAt(z0)+.02;
       line([x,gy,z0],[x,gy+1.0,z0],'#477044',3);line([x-.28,gy+.48,z0],[x-.28,gy+.72,z0],'#477044',2);line([x+.28,gy+.34,z0],[x+.28,gy+.58,z0],'#477044',2);
     }
     if(n%4===0){
       const x=2.6+Math.sin(n*2.1)*1.1,gy=floorAt(z0)+.03;
       polygon([[x-.34,gy,z0],[x+.36,gy,z0],[x+.28,gy+.16,z0],[x-.2,gy+.22,z0]],'#7d3f31','#613228',.5);
     }
   }
   if(flight.z<14){
     polygon([[-.72,3.03,-1],[-.72,3.03,.25],[.72,3.03,.25],[.72,3.03,-1]],'#d18a50','#7f422f');
     line([-.52,3.05,0],[-.52,3.6,0],'#6a3b2d',3);line([.52,3.05,0],[.52,3.6,0],'#6a3b2d',3);
     if(state==='ready'){const z=-((pull&&pull.power)||0)*.25;line([-.52,3.55,0],[0,3.18,z],'#6a3b2d',2);line([0,3.18,z],[.52,3.55,0],'#6a3b2d',2);}
   }
 }
 function box(o){
   const {x,y,z,rx,ry,rz}=o,c=o.type==='clip'?'#353530':'#99978d';
   polygon([[x-rx,y-ry,z-rz],[x+rx,y-ry,z-rz],[x+rx,y+ry,z-rz],[x-rx,y+ry,z-rz]],c,'#35352f',1);
   polygon([[x-rx,y+ry,z-rz],[x+rx,y+ry,z-rz],[x+rx,y+ry,z+rz],[x-rx,y+ry,z+rz]],'#d6d4c9','#55544c');
   polygon([[x+rx,y-ry,z-rz],[x+rx,y-ry,z+rz],[x+rx,y+ry,z+rz],[x+rx,y+ry,z-rz]],'#65645c','#44443d');
 }
 function object(o){
   if(o.z<camera.z-.7)return;
   if(o.type==='ring'){
     if(o.passed)return;
     const vertices=[];
     for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;vertices.push([o.x+Math.cos(a)*o.radius,o.y+Math.sin(a)*o.radius,o.z]);}
     for(let i=0;i<24;i++)line(vertices[i],vertices[i+1],'#45443d',2.5);
   }else if(o.type==='paper'){
     const {x,y,z,rx,ry}=o,top=[x-.13,y+ry,z],bottom=[x+.12,y-ry,z];
     polygon([[x-rx,y-.1,z-.2],top,bottom],'#efede3','#56554d');
     polygon([top,[x+rx,y-.15,z-.1],bottom],'#aaa89c','#56554d');
   }else{
     box(o);
     if(o.type==='clip'){
       line([o.x,o.y+o.ry,o.z],[o.x,roofAt(o.x,o.z),o.z],'#59584e',1);
       for(const side of [-1,1]){
         const x=o.x+side*.18;
         line([x-.12,o.y+.20,o.z-.27],[x-.10,o.y+.93,o.z-.27],'#dddacf',2);
         line([x-.10,o.y+.93,o.z-.27],[x+.10,o.y+.93,o.z-.27],'#dddacf',2);
         line([x+.10,o.y+.93,o.z-.27],[x+.12,o.y+.20,o.z-.27],'#dddacf',2);
       }
     }else polygon([[o.x-o.rx,o.y-.12,o.z-.256],[o.x+o.rx,o.y-.12,o.z-.256],[o.x+o.rx,o.y+.18,o.z-.256],[o.x-o.rx,o.y+.18,o.z-.256]],'#e5e2d6',null);
   }
 }
 function plane(){
   const cr=Math.cos(flight.roll),sr=Math.sin(flight.roll),cp=Math.cos(flight.pitch),sp=Math.sin(flight.pitch),ch=Math.cos(flight.heading),sh=Math.sin(flight.heading);
   function p(x,y,z){const a=cr*x+sr*y,b=-sr*x+cr*y,c=cp*b+sp*z,d=-sp*b+cp*z;return [flight.x+ch*a+sh*d,flight.y+c,flight.z-sh*a+ch*d];}
   const shadowY=floorAt(flight.z)+.008;
   polygon([[flight.x,shadowY,flight.z+.18],[flight.x-.15,shadowY,flight.z-.15],[flight.x+.15,shadowY,flight.z-.15]],'#858378',null);
   const nose=p(0,0,.19),left=p(-.14,0,-.14),right=p(.14,0,-.14),l=p(-.022,0,-.065),r=p(.022,0,-.065),keel=p(0,-.052,-.14);
   polygon([nose,left,l],'#f9f7ed','#303029',1.1);polygon([nose,r,right],'#e9e6db','#303029',1.1);
   polygon([nose,l,keel],'#a3a094','#45443b',.8);polygon([nose,keel,r],'#d3d0c3','#45443b',.8);
 }
 function follow(dt,snap=false){
   const k=snap?1:1-Math.exp(-7*dt);
   // Stable chase camera: the valley stays level and never rotates with the plane.
   camera.yaw=0;
   camera.x+=(flight.x-camera.x)*k;
   camera.y+=(flight.y+.52-camera.y)*k;camera.z+=(flight.z-1.1-camera.z)*k;
   const gamma=Math.atan2(flight.vy,Math.hypot(flight.vx,flight.vz));camera.pitch+=(clamp(gamma*.18,-.16,.12)-camera.pitch)*k;
 }
 function hud(){
   $('distance').textContent=Math.floor(flight.distance);$('altitude').textContent=Math.max(0,flight.altitude).toFixed(1);
   $('speed').textContent=flight.speed.toFixed(1)+' m/s';$('time').textContent=flight.time.toFixed(1)+' s';$('rings').textContent='OCHIQ MAYDON';$('record').textContent='REKORD '+best+' m';
   $('warning').textContent=state==='playing'?(flight.stalled?'STALL — BURUNNI PASTLATING':Math.abs(flight.alpha)>P.stallAngle*.8?'BURCHAK KATTA — EHTIYOT BO‘LING':flight.altitude<.6?'YER YAQIN — QANOTNI TEKISLANG':''):'';
 }
 function release(){drag=null;pull=null;flight.release();keys.clear();$('stick').hidden=true;$('pull-knob').style.transform='none';$('power').textContent='KUCH 0%';}
 function ready(){release();flight.reset();state='ready';last=0;follow(0,true);$('overlay').hidden=true;$('launch-panel').hidden=false;$('pause').disabled=false;$('hint').hidden=true;}
 function startFlight(power,yaw=0){
   if(!flight.launch(power,launchAngle*Math.PI/180,yaw))return;
   audio.launch(power);
   release();state='playing';last=0;$('launch-panel').hidden=true;$('hint').hidden=false;
 }
 function show(mode){
   state=mode;release();$('overlay').hidden=false;$('launch-panel').hidden=true;$('hint').hidden=true;$('pause').disabled=true;
   const paused=mode==='paused',landed=flight.status==='landed';
   $('title').innerHTML=paused?'Bir oz<br>tanaffus<span>Ⅱ</span>':landed?'Yumshoq<br>qo‘nish<span>✓</span>':'Yana bir<br>parvoz?<span>↗</span>';
   $('description').textContent=paused?'Parvozingiz shu yerda kutib turadi.':landed?'Tezlik, muvozanat va yaxshi qo‘nish.':flight.reason==='wall'?'Tunnel devoriga tegdingiz. Burilishni ertaroq boshlang.':flight.reason==='obstacle'?'To‘siqqa tegdingiz. Qanotni og‘dirib yo‘nalishni o‘zgartiring.':'Qattiq qo‘nish. Pasayish tezligi va qanot og‘ishini kamaytiring.';
   $('result').textContent=Math.floor(flight.distance)+' METR · '+flight.time.toFixed(1)+' SONIYA · OCHIQ MAYDON · MAX '+flight.maxSpeed.toFixed(1)+' m/s';
   $('start').innerHTML=paused?'DAVOM ETISH <span>↗</span>':'YANA UCHIRISH <span>↗</span>';$('restart').hidden=!paused;
 }
 window.pauseGame=()=>{if(state==='playing'||state==='ready'){resumeState=state;show('paused');}};
 $('pause').onclick=window.pauseGame;
 $('start').onclick=()=>{
   audio.unlock();
   if(state==='paused'){state=resumeState;last=0;$('overlay').hidden=true;$('pause').disabled=false;$('launch-panel').hidden=state!=='ready';$('hint').hidden=state!=='playing';}else ready();
 };
 $('restart').onclick=ready;
 const zone=$('pull-zone');
 zone.addEventListener('pointerdown',e=>{if(state!=='ready')return;audio.unlock();zone.setPointerCapture(e.pointerId);pull={id:e.pointerId,x:e.clientX,y:e.clientY,power:0,yaw:0};});
 zone.addEventListener('pointermove',e=>{if(!pull||pull.id!==e.pointerId)return;const dx=clamp(e.clientX-pull.x,-85,85),dy=clamp(e.clientY-pull.y,0,85);pull.power=dy/85;pull.yaw=-dx/85*.25;$('pull-knob').style.transform='translate('+dx+'px,'+dy+'px)';$('power').textContent='KUCH '+Math.round(pull.power*100)+'%';});
 zone.addEventListener('pointerup',e=>{if(!pull||pull.id!==e.pointerId)return;const {power,yaw}=pull;if(power>.12)startFlight(power,yaw);else release();});
 zone.addEventListener('pointercancel',release);zone.addEventListener('lostpointercapture',()=>{if(pull)release();});
 canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||drag)return;audio.unlock();canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('stick').hidden=false;$('stick').style.left=(e.clientX-58)+'px';$('stick').style.top=(e.clientY-58)+'px';$('stick').querySelector('i').style.transform='none';});
 canvas.addEventListener('pointermove',e=>{
   if(!drag||drag.id!==e.pointerId)return;
   const dx=clamp((e.clientX-drag.x)/65,-1,1),dy=clamp((e.clientY-drag.y)/65,-1,1);
   flight.steer(dx*sensitivity,(invert?dy:-dy)*sensitivity);$('stick').querySelector('i').style.transform='translate('+dx*37+'px,'+dy*37+'px)';
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag&&drag.id===e.pointerId)release();});
 window.addEventListener('keydown',e=>{
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
   if(e.key==='Escape'||(e.key===' '&&state==='playing')){window.pauseGame();return;}
   if(state==='ready'&&(e.key===' '||e.key==='Enter')){e.preventDefault();startFlight(.65);return;}keys.add(e.key.toLowerCase());
 });
 window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(!drag)flight.release();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)window.pauseGame();last=0;});
 window.addEventListener('blur',window.pauseGame);window.addEventListener('resize',()=>{release();resize();});
 function frame(t){
   requestAnimationFrame(frame);const dt=last?Math.min((t-last)/1000,.1):0;last=t;
   if(state==='playing'){
     if(!drag){const x=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),y=(keys.has('arrowup')||keys.has('w')?1:0)-(keys.has('arrowdown')||keys.has('s')?1:0);flight.steer(x*sensitivity,y*sensitivity*(invert?-1:1));}
     flight.update(dt);follow(dt);audio.update(flight,state);
     for(const event of flight.events.splice(0)){
       if(event==='ring'){toastUntil=t+900;$('toast').textContent='+1 HALQA';}
       else {best=Math.max(best,Math.floor(flight.distance));save('notebook-best',best);show('ended');}
     }
   } else audio.update(flight,state);
   if(t-renderAt<(economy?32:15))return;renderAt=t;
   environment();
   const items=flight.objects.map(o=>({o,depth:view([o.x,o.y,o.z])[2]}));items.push({o:null,depth:view([flight.x,flight.y,flight.z])[2]});items.sort((a,b)=>b.depth-a.depth);
   for(const item of items){if(item.o)object(item.o);else plane();}
   hud();$('toast').style.opacity=t<toastUntil?'1':'0';
 }
 settings();follow(0,true);hud();$('pause').disabled=true;requestAnimationFrame(frame);
})();
