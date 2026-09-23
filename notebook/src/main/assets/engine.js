(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 // SI units; reduced coordinated-flight model, not CFD or a six-DOF solver.
 const P=Object.freeze({mass:.005,area:.018,rho:1.225,g:9.81,clSlope:2.15,
   cd0:.028,induced:.22,stallAngle:Math.PI/6,trimAlpha:.10,step:1/120,
   halfWidth:4.8,span:.28});
 function aero(alpha){
   alpha=wrap(alpha);const a=Math.abs(alpha),sign=Math.sign(alpha),peak=P.clSlope*P.stallAngle;
   const cl=a<=P.stallAngle?P.clSlope*alpha:
     sign*peak*Math.exp(-3.8*(a-P.stallAngle))*Math.max(0,Math.cos(a-P.stallAngle));
   const separated=Math.max(0,Math.sin(a)-Math.sin(P.stallAngle));
   return {cl,cd:P.cd0+P.induced*cl*cl+1.9*separated*separated,stalled:a>P.stallAngle};
 }
 function floorAt(z){return -.14*z+.18*Math.sin(z/24);}
 function floorSlope(z){return -.14+.18/24*Math.cos(z/24);}
 function roofAt(x,z){return floorAt(z)+5.7+1.8*Math.sqrt(Math.max(0,1-(x/P.halfWidth)**2));}
 function segmentBox(a,b,o,pad){
   let lo=0,hi=1;
   for(const [key,r] of [['x',o.rx+pad],['y',o.ry+pad*.4],['z',o.rz+pad]]){
     const d=b[key]-a[key],min=o[key]-r,max=o[key]+r;
     if(Math.abs(d)<1e-9){if(a[key]<min||a[key]>max)return false;continue;}
     let t0=(min-a[key])/d,t1=(max-a[key])/d;
     if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);
     if(lo>hi)return false;
   }return true;
 }
 class Flight {
   constructor(options={}){this.random=options.random||Math.random;this.environment=options.environment!==false;this.obstacles=options.obstacles!==false;this.openWorld=options.openWorld===true;this.reset();}
   reset(){
     this.x=0;this.y=3.2;this.z=0;this.vx=0;this.vy=0;this.vz=0;
     this.pitch=.14;this.pitchRate=0;this.roll=0;this.rollRate=0;this.heading=0;
     this.input={roll:0,pitch:0};this.status='ready';this.distance=0;this.time=0;this.rings=0;
     this.speed=0;this.maxSpeed=0;this.alpha=0;this.stalled=false;this.events=[];this.objects=[];
     this.nextSpawn=22;this.count=0;this.accumulator=0;this.reason='';this.pathLength=0;
     if(this.obstacles)this.populate();
   }
   get altitude(){return this.y-floorAt(this.z);}
   get energy(){return .5*P.mass*(this.vx*this.vx+this.vy*this.vy+this.vz*this.vz)+P.mass*P.g*this.y;}
   launch(power=.65,elevation=.10,heading=0){
     if(this.status!=='ready')return false;
     const v=3.8+clamp(power,0,1)*4.2,e=clamp(elevation,-.12,.36),yaw=clamp(heading,-.32,.32);
     this.vx=v*Math.cos(e)*Math.sin(yaw);this.vy=v*Math.sin(e);this.vz=v*Math.cos(e)*Math.cos(yaw);
     this.pitch=e+P.trimAlpha;this.heading=yaw;this.speed=v;this.maxSpeed=v;this.status='flying';return true;
   }
   steer(roll,pitch){this.input.roll=clamp(roll,-1,1);this.input.pitch=clamp(pitch,-1,1);}
   release(){this.steer(0,0);}
   populate(){
     while(this.nextSpawn<this.z+90){
       const z=this.nextSpawn,x=(this.random()-.5)*6,y=floorAt(z)+2.4+this.random()*2.2;
       const type=['clip','eraser','paper'][this.count%3];
       this.objects.push({type,x,y,z,rx:type==='paper'?.53:.38,ry:type==='clip'?.65:.4,rz:.25});
       this.objects.push({type:'ring',x:x>=0?-1.55:1.55,y:floorAt(z+6)+2.7,z:z+6,radius:.65,passed:false});
       this.count++;this.nextSpawn+=15;
     }
     this.objects=this.objects.filter(o=>o.z>this.z-8);
   }
   forces(vx,vy,vz){
     const speed=Math.hypot(vx,vy,vz);
     if(speed<1e-5)return {ax:0,ay:-P.g,az:0,alpha:0,stalled:false};
     const horizontal=Math.hypot(vx,vz),gamma=Math.atan2(vy,horizontal);
     const alpha=wrap(this.pitch-gamma),coeff=aero(alpha),q=.5*P.rho*speed*speed*P.area/P.mass;
     const ux=vx/speed,uy=vy/speed,uz=vz/speed;
     const hx=horizontal>1e-6?vx/horizontal:Math.sin(this.heading),hz=horizontal>1e-6?vz/horizontal:Math.cos(this.heading);
     const cs=Math.cos(this.roll),sn=Math.sin(this.roll);
     const lx=-uy*hx*cs+hz*sn,ly=horizontal/speed*cs,lz=-uy*hz*cs-hx*sn;
     return {ax:q*(coeff.cl*lx-coeff.cd*ux),ay:q*(coeff.cl*ly-coeff.cd*uy)-P.g,
       az:q*(coeff.cl*lz-coeff.cd*uz),alpha,stalled:coeff.stalled};
   }
   finish(status,reason){this.status=status;this.reason=reason;this.release();this.events.push(status);}
   tick(dt){
     const old={x:this.x,y:this.y,z:this.z};
     const gamma=Math.atan2(this.vy,Math.hypot(this.vx,this.vz));
     // Virtual elevons set pitch trim and bank with finite angular response.
     // Neutral controls restore trim, not altitude or kinetic energy.
     const pitchTarget=gamma+P.trimAlpha+this.input.pitch*.66;
     this.pitchRate+=(12*wrap(pitchTarget-this.pitch)-6*this.pitchRate)*dt;
     this.pitch=wrap(this.pitch+this.pitchRate*dt);
     this.rollRate+=(20*(this.input.roll*1.02-this.roll)-7*this.rollRate)*dt;
     this.roll+=this.rollRate*dt;
     const a=this.forces(this.vx,this.vy,this.vz);
     const mx=this.vx+a.ax*dt*.5,my=this.vy+a.ay*dt*.5,mz=this.vz+a.az*dt*.5;
     const b=this.forces(mx,my,mz);
     this.x+=mx*dt;this.y+=my*dt;this.z+=mz*dt;
     this.vx+=b.ax*dt;this.vy+=b.ay*dt;this.vz+=b.az*dt;
     this.speed=Math.hypot(this.vx,this.vy,this.vz);this.maxSpeed=Math.max(this.maxSpeed,this.speed);
     this.heading=Math.atan2(this.vx,this.vz);this.alpha=b.alpha;this.stalled=b.stalled;
     this.time+=dt;this.pathLength+=Math.hypot(mx,my,mz)*dt;this.distance=Math.max(0,this.z);
     if(this.environment){
       const clearance=.045+Math.abs(Math.sin(this.roll))*P.span*.5;
       if(this.altitude<=clearance){
         const sink=this.vy-floorSlope(this.z)*this.vz;
         const soft=Math.abs(sink)<.85&&Math.hypot(this.vx,this.vz)<6.5&&Math.abs(this.roll)<.35&&!this.stalled;
         this.y=floorAt(this.z)+clearance;this.finish(soft?'landed':'crashed',soft?'soft':'ground');return;
       }
       if(!this.openWorld&&(Math.abs(this.x)+P.span*.5>=P.halfWidth||this.y+clearance>=roofAt(this.x,this.z))){
         this.finish('crashed','wall');return;
       }
     }
     for(const o of this.objects){
       if(o.type==='ring'){
         if(!o.passed&&old.z<o.z&&this.z>=o.z){
           o.passed=true;const t=(o.z-old.z)/(this.z-old.z);
           if(Math.hypot(old.x+(this.x-old.x)*t-o.x,old.y+(this.y-old.y)*t-o.y)<o.radius-P.span*.25){this.rings++;this.events.push('ring');}
         }
       }else if(segmentBox(old,this,o,P.span*.5)){this.finish('crashed','obstacle');return;}
     }
     if(this.obstacles)this.populate();
   }
   update(seconds){
     if(this.status!=='flying'||!Number.isFinite(seconds)||seconds<=0)return;
     this.accumulator+=Math.min(seconds,.25);
     while(this.accumulator+1e-10>=P.step&&this.status==='flying'){
       this.accumulator-=P.step;this.tick(P.step);
     }
   }
 }
 const api={Flight,P,aero,floorAt,floorSlope,roofAt,segmentBox,clamp};
 if(typeof module!=='undefined')module.exports=api;
 root.NotebookPhysics=api;root.NotebookFlight=Flight;
})(typeof window!=='undefined'?window:globalThis);
