(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class Flight {
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){this.x=0;this.y=-.48;this.tx=0;this.ty=-.48;this.distance=0;this.rings=0;this.speed=18;this.alive=true;this.objects=[];this.spawnAt=12;this.count=0;this.events=[];}
    steer(x,y){this.tx=clamp(x,-.8,.8);this.ty=clamp(y,-.78,.68);}
    spawn(){
      const x=(this.random()-.5)*1.28,y=(this.random()-.5)*1.1;
      const type=this.count%3===0?'clip':this.count%3===1?'eraser':'paper';
      this.objects.push({type,x,y,z:100,rx:type==='paper'?.27:.19,ry:type==='clip'?.28:.19,passed:false});
      // A collectible beside each obstacle, with a safe gap and enough travel time.
      this.objects.push({type:'ring',x:x>0?-.5:.5,y:-.25+(this.random()-.5)*.5,z:108,rx:.22,ry:.22,passed:false});
      this.count++;
    }
    update(dt){
      if(!this.alive)return;
      dt=clamp(dt,0,.05);
      const k=1-Math.exp(-10*dt);
      this.x+=(this.tx-this.x)*k;this.y+=(this.ty-this.y)*k;
      this.speed=Math.min(32,18+this.distance/180);
      const travel=this.speed*dt;this.distance+=travel;this.spawnAt-=travel;
      if(this.spawnAt<=0){this.spawn();this.spawnAt+=27;}
      for(const o of this.objects){
        const old=o.z;o.z-=travel;
        if(!o.passed&&old>=5&&o.z<5){
          o.passed=true;
          if(o.type==='ring'){
            if(Math.hypot((this.x-o.x)/o.rx,(this.y-o.y)/o.ry)<1){this.rings++;this.events.push('ring');}
          }else if(Math.abs(this.x-o.x)<o.rx+.085&&Math.abs(this.y-o.y)<o.ry+.065){
            this.alive=false;this.events.push('crash');break;
          }
        }
      }
      this.objects=this.objects.filter(o=>o.z>-3);
    }
  }
  if(typeof module!=='undefined')module.exports={Flight,clamp};
  root.NotebookFlight=Flight;
})(typeof window!=='undefined'?window:globalThis);
