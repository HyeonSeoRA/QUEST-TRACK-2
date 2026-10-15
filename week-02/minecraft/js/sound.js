'use strict';
/* =====================================================================
   sound.js — 소리를 WebAudio 로 직접 만들어요 (파일 없음)
   ===================================================================== */
const SND={ctx:null,master:null,nb:null,rainG:null,
  init(){if(this.ctx)return;try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
    const len=this.ctx.sampleRate*2;this.nb=this.ctx.createBuffer(1,len,this.ctx.sampleRate);const d=this.nb.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.vol();
    // 빗소리 (계속 재생, 볼륨으로 조절)
    const s=this.ctx.createBufferSource();s.buffer=this.nb;s.loop=true;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;
    this.rainG=this.ctx.createGain();this.rainG.gain.value=0;s.connect(f).connect(this.rainG).connect(this.master);s.start();}catch(e){this.ctx=null;}},
  vol(){if(this.master)this.master.gain.value=SET.vol/100*0.6;},
  at(x,y,z){// 거리에 따른 크기
    if(x===undefined||typeof player==='undefined')return 1;const d=Math.hypot(x-player.x,y-player.y,z-player.z);return clamp(1-d/24,0,1);},
  noise(dur,type,freq,Q,vol,delay=0,rate=1){const c=this.ctx;if(!c||!SET.vol||vol<=0.001)return;const t=c.currentTime+delay,s=c.createBufferSource();s.buffer=this.nb;
    s.playbackRate.value=rate*(0.8+Math.random()*0.4);const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=Q;const g=c.createGain();
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);s.connect(f).connect(g).connect(this.master);s.start(t,Math.random()*1.5);s.stop(t+dur+0.02);},
  tone(f0,f1,dur,type,vol,delay=0){const c=this.ctx;if(!c||!SET.vol||vol<=0.001)return;const t=c.currentTime+delay,o=c.createOscillator();o.type=type;
    o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);const g=c.createGain();g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+0.02);},
  block(kind,mode,x,y,z){const a=this.at(x,y,z);const v=(mode==='step'?0.16:mode==='hit'?0.22:0.55)*a,d=mode==='step'?0.09:mode==='hit'?0.07:0.2;
    switch(kind){case'grass':this.noise(d*1.2,'bandpass',2600,0.6,v);break;case'gravel':this.noise(d*1.3,'bandpass',1500,0.5,v);break;
      case'sand':case'snow':this.noise(d*1.4,'highpass',kind==='snow'?2000:2800,0.5,v*0.8);break;
      case'wood':this.noise(d,'bandpass',420,2.5,v*1.3);this.tone(160,90,d,'triangle',v*0.35);break;
      case'glass':if(mode==='break'){for(let i=0;i<4;i++)this.tone(1800+Math.random()*1800,900,0.25,'triangle',0.12*a,i*0.03);}else this.noise(d,'bandpass',3000,3,v);break;
      case'wool':this.noise(d*1.2,'lowpass',700,0.5,v*0.9);break;
      default:this.noise(d,'bandpass',950,1.4,v);this.tone(220,120,d*0.6,'square',v*0.08);}},
  pop(){this.tone(500+Math.random()*300,1300,0.08,'sine',0.22);},
  orb(){this.tone(1400+Math.random()*600,2200,0.12,'sine',0.12);},
  levelUp(){[0,0.12,0.24].forEach((d,i)=>this.tone(660*(1+i*0.25),700*(1+i*0.25),0.25,'triangle',0.15,d));},
  hurt(){this.tone(260,110,0.18,'square',0.12);this.noise(0.12,'lowpass',600,1,0.3);},
  click(){this.tone(1100,700,0.04,'square',0.08);},
  eat(){this.noise(0.1,'bandpass',1800,1,0.35);},
  burp(){this.tone(180,90,0.25,'sawtooth',0.12);},
  splash(x,y,z){this.noise(0.45,'lowpass',1200,0.7,0.4*this.at(x,y,z));},
  sizzle(x,y,z){this.noise(0.5,'highpass',3000,0.7,0.25*this.at(x,y,z));},
  breakTool(){this.tone(900,200,0.25,'sawtooth',0.15);},
  door(open,x,y,z){const a=this.at(x,y,z);this.noise(0.15,'bandpass',open?500:350,2,0.5*a);this.tone(open?200:140,open?260:100,0.12,'triangle',0.2*a);},
  chest(open,x,y,z){const a=this.at(x,y,z);this.noise(0.25,'bandpass',300,2,0.4*a);this.tone(open?120:160,open?180:90,0.25,'sawtooth',0.06*a);},
  explode(x,y,z){const a=Math.max(0.3,this.at(x,y,z));this.noise(1.6,'lowpass',500,0.6,1.0*a);this.noise(0.6,'lowpass',1500,0.6,0.7*a);this.tone(90,30,0.9,'sine',0.6*a);},
  fuse(x,y,z){this.noise(1.2,'highpass',4000,0.5,0.3*this.at(x,y,z));},
  bow(){this.noise(0.12,'bandpass',800,3,0.3);this.tone(300,180,0.12,'triangle',0.15);},
  arrowHit(x,y,z){this.noise(0.08,'bandpass',1200,3,0.3*this.at(x,y,z));},
  ignite(){this.noise(0.2,'highpass',2500,1,0.3);},
  bucket(fill){this.noise(0.35,'lowpass',fill?900:600,1,0.4);},
  mob(type,kind,x,y,z){const a=this.at(x,y,z);if(a<=0)return;const v=0.35*a;
    if(kind==='hurt'){this.tone(type==='chicken'?900:type==='pig'?500:type==='zombie'?160:300,type==='chicken'?600:200,0.18,'square',v*0.5);return;}
    if(kind==='death'){this.tone(type==='chicken'?700:300,80,0.4,'sawtooth',v*0.4);return;}
    switch(type){
      case'pig':this.tone(300,240,0.12,'sawtooth',v*0.3);this.noise(0.15,'bandpass',600,2,v*0.5);this.tone(260,200,0.12,'sawtooth',v*0.25,0.16);break;
      case'cow':{const c=this.ctx;if(!c)break;this.tone(150,110,0.9,'sawtooth',v*0.35);this.tone(152,108,0.9,'sawtooth',v*0.2);break;}
      case'sheep':for(let i=0;i<5;i++)this.tone(420+(i%2)*30,400,0.1,'sawtooth',v*0.25,i*0.09);break;
      case'chicken':for(let i=0;i<3;i++)this.tone(1100,800,0.06,'square',v*0.25,i*0.11);break;
      case'zombie':this.tone(110,80,1.0,'sawtooth',v*0.35);this.noise(0.9,'lowpass',400,1,v*0.5);break;
      case'skeleton':for(let i=0;i<4;i++)this.noise(0.04,'bandpass',2500,5,v*0.6,i*0.06);break;
      case'spider':this.noise(0.5,'bandpass',900,6,v*0.5);this.tone(200,180,0.4,'square',v*0.1);break;
      case'creeper':break;}},
  setRain(v){if(this.rainG)this.rainG.gain.setTargetAtTime(v*0.25,this.ctx.currentTime,0.5);}};
