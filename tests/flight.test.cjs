const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Flight}=require('../notebook/src/main/assets/engine.js');
test('movement limits and restart',()=>{
 const f=new Flight(()=>.5);f.steer(9,-9);assert.equal(f.tx,.8);assert.equal(f.ty,-.78);
 f.update(.05);assert.ok(f.x>0);f.reset();assert.equal(f.distance,0);assert.equal(f.alive,true);assert.equal(f.objects.length,0);
});
test('crossing obstacle causes collision exactly once',()=>{
 const f=new Flight();f.objects=[{type:'eraser',x:0,y:f.y,z:5.1,rx:.2,ry:.2,passed:false}];f.update(.02);
 assert.equal(f.alive,false);assert.deepEqual(f.events,['crash']);const d=f.distance;f.update(.05);assert.equal(f.distance,d);
});
test('ring collection once and safe missed obstacle',()=>{
 const f=new Flight();f.objects=[{type:'ring',x:0,y:f.y,z:5.1,rx:.22,ry:.22,passed:false},{type:'clip',x:.7,y:.6,z:5.1,rx:.19,ry:.28,passed:false}];
 f.update(.02);f.update(.02);assert.equal(f.rings,1);assert.equal(f.alive,true);assert.deepEqual(f.events,['ring']);
});
test('spawn population stays bounded over long runs',()=>{
 const f=new Flight(()=>.99);for(let i=0;i<36000;i++)f.update(1/60);
 assert.ok(f.alive);assert.ok(f.objects.length<12);assert.ok(f.speed<=32);assert.ok(f.distance>10000);
});
test('frame rate independence',()=>{
 const a=new Flight(()=>.99),b=new Flight(()=>.99);
 for(let i=0;i<300;i++)a.update(1/30);for(let i=0;i<600;i++)b.update(1/60);
 assert.ok(Math.abs(a.distance-b.distance)<.2);
});
test('large frame gaps are capped',()=>{const f=new Flight();f.update(30);assert.ok(f.distance<1);});
