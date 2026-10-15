/* ArcMap Rage Room character reactions and facial animation.
   Performs stylized fictional facial responses synchronized with CC0 voice clips.
   Performer credit: HaelDB, "Male Grunt/Yelling sounds" (CC0). */
(function(){
  'use strict';
  const root=window;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const state={
    mode:'idle',until:0,lastVoice:-10000,lastSustain:-10000,
    strength:0,mouth:0,audio:null,analyser:null,scope:null,clips:null,
    current:null,muted:false
  };
  const timestamp=()=>performance.now();
  function initializeAudio(){
    if(state.clips)return true;
    const urls=root.ARCMAP_VOICE_CLIPS;
    if(!urls?.light || !urls?.medium || !urls?.heavy)return false;
    try {
      const clips={};
      for(const k of ['light','medium','heavy']){
        clips[k]=new Audio(urls[k]);
        clips[k].preload='auto';
        clips[k].volume=k==='heavy'?.85:.76;
      }
      state.clips=clips;
      const AC=root.AudioContext||root.webkitAudioContext;
      if(AC){
        const ac=new AC(),analyser=ac.createAnalyser(),volume=ac.createGain();
        analyser.fftSize=512;analyser.smoothingTimeConstant=.55;
        volume.gain.value=.68;analyser.connect(volume);volume.connect(ac.destination);
        for(const a of Object.values(clips))ac.createMediaElementSource(a).connect(analyser);
        state.audio=ac;state.analyser=analyser;state.scope=new Uint8Array(analyser.fftSize);
      }
      return true;
    }catch(e){
      console.warn('ArcMap recorded voice fallback',e);
      return !!state.clips;
    }
  }
  function stop(){
    if(state.clips)for(const a of Object.values(state.clips)){
      try{a.pause();a.currentTime=0;}catch(e){}
    }
    state.current=null;state.mouth=0;
  }
  function play(kind){
    if(!initializeAudio()||state.muted)return;
    if(state.audio?.state==='suspended')state.audio.resume().catch(()=>{});
    if(state.current && !state.current.paused){
      try{state.current.pause();state.current.currentTime=0;}catch(e){}
    }
    const el=state.clips[kind]||state.clips.light;
    try{el.currentTime=0;const result=el.play();if(result?.catch)result.catch(()=>{});state.current=el;}catch(e){}
  }
  function react(force,game){
    const time=timestamp();
    const intensity=clamp(force/13,0,1);
    const isHeavy=force>9||game?.material?.heat>.75;
    state.mode=isHeavy?'scream':force>4?'pain':'wince';
    state.until=time+(isHeavy?1650:force>4?950:530);
    state.strength=Math.max(state.strength,intensity);
    if(game) game.lastVoice=game.time;
    if(game?.voiceOn===false||root.ARCMAP_GAME_MUTED||state.muted)return;
    const delay=isHeavy?1100:force>4?630:425;
    if(time-state.lastVoice<delay)return;
    state.lastVoice=time;
    const kind=isHeavy?'heavy':force>4?'medium':'light';
    play(kind);
  }
  function audioLevel(){
    if(!state.analyser||!state.scope||!state.current||state.current.paused)return 0;
    state.analyser.getByteTimeDomainData(state.scope);
    let sum=0;
    for(const v of state.scope){const n=(v-128)/128;sum+=n*n;}
    return clamp(Math.sqrt(sum/state.scope.length)*7.5,0,1);
  }
  const stroke=(ctx,color,width,a,b,c,d)=>{
    ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  };
  function drawFace(ctx,game){
    if(!game||game.destroyed)return;
    const t=timestamp(),m=game.material||{};
    if(game.cricketCharging&&game.cricketCharge>.4)state.mode='fear';
    else if(m.frost>.65&&t>state.until)state.mode='frozen';
    else if(game.arc>.055)state.mode='shock';
    else if(game.flameTime>.03&&m.heat>.08)state.mode='scream';
    else if(game.drag&&(Math.abs(game.drag.vx||0)+Math.abs(game.drag.vy||0)>850))state.mode='fear';
    else if(t>state.until)state.mode='idle';
    if(game.voiceOn!==false&&!root.ARCMAP_GAME_MUTED&&t-state.lastSustain>1200
       &&((game.flameTime>.055&&m.heat>.12)||game.arc>.12)){
      state.lastSustain=t;react(game.arc>.12?10:12,game);
    }
    const level=(game.voiceOn!==false&&!root.ARCMAP_GAME_MUTED)?audioLevel():0;
    const active=state.current&&!state.current.paused&&!state.current.ended;
    const open=(active ? Math.max(level, .12 + .32*Math.abs(Math.sin(t*.023))) : 0);
    const mood=state.mode;
    const tense=mood!=='idle';
    const screaming=mood==='scream'||mood==='shock'||(active&&state.strength>.6);
    const wide=clamp(screaming?Math.max(.58,open):mood==='fear'?.42:mood==='pain'?.36:0,0,1);
    state.mouth=state.mouth*.58+wide*.42;
    if(!active&&t>state.until)state.strength=Math.max(0,state.strength-.025);
    const x=-28,y=17;
    ctx.save();
    // Face elements are local to the central badge and rotate with the actual ragdoll.
    ctx.lineJoin='round';ctx.lineCap='round';
    // Dark under-eye and cheek shading intensifies as damage accumulates.
    const wear=clamp((game.wear||0)/100,0,1);
    if(wear>.2){ctx.globalAlpha=wear*.28;ctx.fillStyle='#6d1736';
      ctx.beginPath();ctx.ellipse(x-20,y+11,18,8,-.18,0,Math.PI*2);ctx.ellipse(x+20,y+11,18,8,.18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    const shake=mood==='shock'?Math.sin(t*.095)*2:0;
    for(let i=0;i<2;i++){
      const ex=x+(i===0?-21:21)+shake;
      const blink=mood==='idle'&&Math.sin(t*.0016)<-.985;
      const squint=mood==='pain'||mood==='wince'||mood==='scream';
      const eyeHeight=blink?1.7:squint?4.5:mood==='fear'?13:9.3;
      ctx.fillStyle='#132836';ctx.beginPath();ctx.ellipse(ex,y,13,eyeHeight+2,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f4f5f3';ctx.beginPath();ctx.ellipse(ex,y-1,10,eyeHeight,0,0,Math.PI*2);ctx.fill();
      if(!squint&&!blink){
        ctx.fillStyle=mood==='shock'?'#3951d6':'#1e384d';
        ctx.beginPath();ctx.arc(ex+(mood==='fear'?0:3),y,3.8,0,Math.PI*2);ctx.fill();
      }
      const browAngle=mood==='fear'||mood==='scream' ? (i===0?-6:6):tense?(i===0?5:-5):0;
      stroke(ctx,'#1b2b3c',4,ex-11,y-20+browAngle,ex+11,y-20-browAngle);
    }
    const mouthY=y+29;
    if(state.mouth>.18){
      const h=4+state.mouth*16,w=8+state.mouth*8;
      ctx.beginPath();ctx.ellipse(x,mouthY,w,h,0,0,Math.PI*2);
      ctx.fillStyle='#221b27';ctx.fill();ctx.lineWidth=2.7;ctx.strokeStyle='#fcdbdb';ctx.stroke();
      ctx.fillStyle='#e5a0ac';ctx.beginPath();ctx.ellipse(x,mouthY+h*.42,w*.65,Math.max(1.6,h*.2),0,0,Math.PI*2);ctx.fill();
      if(state.mouth>.52){ctx.fillStyle='#f5f1e9';ctx.fillRect(x-w*.65,mouthY-h*.72,w*1.3,3.8);}
    }else if(mood==='frozen'||mood==='pain'||mood==='wince'){
      ctx.fillStyle='#faf9f1';ctx.strokeStyle='#15293a';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.roundRect(x-13,mouthY-2,26,9,2);ctx.fill();ctx.stroke();
      for(let k=-6;k<12;k+=7)stroke(ctx,'#b6b1b0',1.4,x+k,mouthY-1,x+k,mouthY+6);
    }else{
      ctx.strokeStyle='#243647';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(x,mouthY-5,10,.2,Math.PI-.2);ctx.stroke();
    }
    if(mood==='fear'||mood==='scream'){
      ctx.fillStyle='#bcecfb';ctx.globalAlpha=.78;
      ctx.beginPath();ctx.ellipse(x+39,y+19,3.2,6,.1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(m.heat>.25){
      ctx.fillStyle='rgba(29,28,27,'+(clamp(m.heat*.23,0,.24))+')';
      ctx.beginPath();ctx.ellipse(x+38,y-23,8,4,.6,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  root.ArcCharacterFX={
    react,drawFace,stop,
    setMuted(value){state.muted=!!value;if(value)stop();},
    get status(){return {mode:state.mode,voiceActive:!!(state.current&&!state.current.paused),mouth:state.mouth};}
  };
})();
