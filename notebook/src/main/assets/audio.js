(() => {
  'use strict';
  class FlightAudio {
    constructor() { this.ctx=null; this.master=null; this.music=null; this.sfx=null; this.windGain=null; this.windFilter=null; this.enabled=true; this.lastWhoosh=0; }
    ensure() {
      if (this.ctx) return true;
      const C=window.AudioContext||window.webkitAudioContext; if(!C) return false;
      try {
        this.ctx=new C(); this.master=this.ctx.createGain(); this.master.gain.value=.55; this.master.connect(this.ctx.destination);
        this.music=this.ctx.createGain(); this.music.gain.value=.28; this.music.connect(this.master);
        this.sfx=this.ctx.createGain(); this.sfx.gain.value=.52; this.sfx.connect(this.master);
        this.createWind(); this.startMusic(); return true;
      } catch(e) { this.ctx=null; return false; }
    }
    unlock() { if(!this.enabled||!this.ensure())return; if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{}); }
    createWind() {
      const size=this.ctx.sampleRate*2, b=this.ctx.createBuffer(1,size,this.ctx.sampleRate), d=b.getChannelData(0); let last=0;
      for(let i=0;i<size;i++){last=last*.985+(Math.random()*2-1)*.15;d[i]=last;}
      const src=this.ctx.createBufferSource(); src.buffer=b; src.loop=true; this.windFilter=this.ctx.createBiquadFilter(); this.windFilter.type='bandpass'; this.windFilter.frequency.value=520; this.windFilter.Q.value=.55;
      this.windGain=this.ctx.createGain(); this.windGain.gain.value=0; src.connect(this.windFilter).connect(this.windGain).connect(this.sfx); src.start();
    }
    startMusic() {
      const add=(type,f,g)=>{const o=this.ctx.createOscillator(),x=this.ctx.createGain();o.type=type;o.frequency.value=f;x.gain.value=g;o.connect(x).connect(this.music);o.start();};
      add('sine',110,.32); add('triangle',164.81,.12); add('sine',220,.045);
      const notes=[220,246.94,293.66,329.63,293.66,246.94]; let i=0;
      const note=()=>{if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='triangle';o.frequency.value=notes[i++%notes.length];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.08,t+.16);g.gain.exponentialRampToValueAtTime(.001,t+2.7);o.connect(g).connect(this.music);o.start(t);o.stop(t+2.8);};
      note(); this.musicTimer=setInterval(note,2800);
    }
    whoosh(amount=.5) {
      if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;if(t-this.lastWhoosh<.25)return;this.lastWhoosh=t;
      const n=Math.floor(this.ctx.sampleRate*.24),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
      const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=b;f.type='bandpass';f.Q.value=.75;f.frequency.setValueAtTime(320,t);f.frequency.exponentialRampToValueAtTime(1250+amount*500,t+.18);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12*amount,t+.035);g.gain.exponentialRampToValueAtTime(.001,t+.23);s.connect(f).connect(g).connect(this.sfx);s.start(t);s.stop(t+.25);
    }
    launch(power=.6){this.unlock();if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});this.whoosh(.5+power*.45);}
    update(flight,state){if(!this.enabled||!this.ctx)return;const t=this.ctx.currentTime,active=state==='playing'&&flight.status==='flying',speed=Math.max(0,Math.min(1,(flight.speed-3)/7));this.windGain.gain.setTargetAtTime(active?.018+speed*.095:0,t,.12);this.windFilter.frequency.setTargetAtTime(380+speed*700,t,.18);if(active&&(Math.abs(flight.rollRate)>.95||Math.abs(flight.pitchRate)>1.15))this.whoosh(Math.min(1,Math.max(Math.abs(flight.rollRate),Math.abs(flight.pitchRate))/4));}
    toggle(){this.enabled=!this.enabled;if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?.55:0,this.ctx.currentTime,.08);return this.enabled;}
  }
  window.NotebookAudio=new FlightAudio();
})();
