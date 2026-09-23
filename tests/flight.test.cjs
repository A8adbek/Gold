const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Flight,P,aero,floorAt,segmentBox}=require('../notebook/src/main/assets/engine.js');
const open=()=>new Flight({environment:false,obstacles:false});
const fly=(f,seconds,fps=120)=>{for(let i=0;i<Math.round(seconds*fps);i++)f.update(1/fps);};
test('ready state does not fly; pull strength and angle set launch velocity',()=>{
 const a=open(),b=open();a.update(1);assert.equal(a.z,0);a.launch(.2,0);b.launch(.8,.2);
 assert.ok(b.speed>a.speed);assert.ok(b.vy>0);assert.equal(a.vy,0);assert.equal(a.launch(),false);
});
test('control changes attitude before position; neutral releases input',()=>{
 const f=open();f.launch();f.steer(1,.5);assert.equal(f.x,0);assert.equal(f.roll,0);
 fly(f,.4);assert.ok(f.roll>0);assert.ok(f.x>0);const roll=f.roll;f.release();fly(f,2);
 assert.equal(f.input.pitch,0);assert.ok(Math.abs(f.roll)<Math.abs(roll)*.1);
});
test('still-air total energy decreases without invisible thrust',()=>{
 for(const controls of [[0,0],[.6,.3],[0,-.4],[0,1]]){
   const f=open();f.launch();f.steer(...controls);let previous=f.energy;
   for(let i=0;i<1200;i++){f.update(1/120);assert.ok(f.energy<=previous+1e-5,'energy increase');previous=f.energy;}
 }
});
test('lift is perpendicular to velocity; drag dissipates energy',()=>{
 const f=open();f.launch();f.roll=.5;const a=f.forces(1,-.7,5);
 const aerodynamicPower=a.ax*1+(a.ay+P.g)*(-.7)+a.az*5;
 assert.ok(aerodynamicPower<0);
});
test('diving trades height for speed',()=>{
 const a=open(),b=open();a.launch();b.launch();b.steer(0,-.4);fly(a,2);fly(b,2);
 assert.ok(b.y<a.y);assert.ok(b.speed>a.speed);assert.ok(b.energy<.3);
});
test('stall depends on angle and the lift curve falls beyond its peak',()=>{
 assert.equal(aero(.10).stalled,false);assert.equal(aero(.8).stalled,true);
 assert.ok(aero(.8).cl<aero(P.stallAngle).cl);assert.ok(aero(1.2).cd>aero(.1).cd);
 const f=open();f.launch();f.steer(0,1);let stalled=false;
 for(let i=0;i<200;i++){f.update(1/120);stalled||=f.stalled;}assert.ok(stalled);
 f.release();fly(f,5);assert.equal(f.stalled,false);assert.ok(Number.isFinite(f.speed));
});
test('frame cadence does not change trajectory',()=>{
 const cases=[30,60,120].map(fps=>{const f=open();f.launch();f.steer(.2,.08);fly(f,4,fps);return f;});
 for(const f of cases.slice(1))for(const key of ['x','y','z','vx','vy','vz','pitch','roll'])assert.ok(Math.abs(f[key]-cases[0][key])<1e-9,key);
});
test('launch-to-neutral glide eventually lands without endless flight',()=>{
 const f=new Flight({obstacles:false});f.launch();fly(f,60);
 assert.equal(f.status,'landed');assert.ok(f.distance>30&&f.distance<180);assert.ok(f.time<60);
 const z=f.z;f.update(1);assert.equal(f.z,z);
});
test('hard ground impact and side wall are crashes',()=>{
 const f=new Flight({obstacles:false});f.launch();f.y=.055;f.vy=-5;f.update(1/120);assert.equal(f.status,'crashed');assert.equal(f.reason,'ground');
 const g=new Flight({obstacles:false});g.launch();g.x=P.halfWidth;g.update(1/120);assert.equal(g.reason,'wall');
});
test('swept obstacle collisions cannot tunnel through a thin blocker',()=>{
 const o={x:0,y:0,z:1,rx:.2,ry:.2,rz:.01};assert.equal(segmentBox({x:0,y:0,z:0},{x:0,y:0,z:2},o,.1),true);
 assert.equal(segmentBox({x:2,y:0,z:0},{x:2,y:0,z:2},o,.1),false);
 const f=open();f.launch();f.objects=[{...o,y:f.y,z:.05}];f.update(.02);assert.equal(f.reason,'obstacle');
});
test('rings score once and do not inject speed',()=>{
 const a=open(),b=open();a.launch();b.launch();a.objects=[{type:'ring',x:0,y:3.2,z:.05,radius:.7,passed:false}];
 fly(a,.1);fly(b,.1);assert.equal(a.rings,1);assert.equal(a.speed,b.speed);assert.deepEqual(a.events,['ring']);
});
test('world objects are bounded and recycle in world coordinates',()=>{
 const f=new Flight({random:()=>.9});for(let z=0;z<10000;z+=3){f.z=z;f.populate();assert.ok(f.objects.length<18);}
 assert.ok(f.objects.every(o=>o.z>f.z-8));
});
test('reset clears run state; invalid and resumed long frames stay finite',()=>{
 const f=open();f.launch();f.update(NaN);f.update(-1);f.update(100);assert.ok(f.time<=.251);
 f.reset();assert.equal(f.status,'ready');assert.equal(f.time,0);assert.equal(f.rings,0);assert.equal(f.z,0);assert.equal(f.y-floorAt(0),3.2);
});
