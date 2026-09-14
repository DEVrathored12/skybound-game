/* Skybound: original Canvas flying game. Asset paths are configurable below. */
const CONFIG = {
  winScore: 20,
  world: { w: 450, h: 800, ground: 76 },
  player: { x: 118, size: 64, gravity: 980, flap: -355, maxFall: 560 },
  obstacles: { width: 62, startX: 510, spacing: 235, baseGap: 190, minGap: 142, speed: 190 },
  assets: { player: "assets/player.jpg" },
  audio: {
    background: "assets/audio/background.ogg",
    gameOver: "assets/audio/game-over.ogg",
    success: "assets/audio/success.ogg"
  }
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);

class AudioManager{
  constructor(paths){
    this.muted=localStorage.getItem("skybound-muted")==="1";
    this.ctx=null;this.buffers={};this.bgNode=null;this.bgGain=null;
    this.paths=paths;this.ready=false;
    this._init();
  }
  async _init(){
    try{
      this.ctx=new(window.AudioContext||window.webkitAudioContext)();
      await Promise.all([
        this._load('bg',this.paths.background),
        this._load('over',this.paths.gameOver),
        this._load('success',this.paths.success)
      ]);
      this.ready=true;
    }catch(e){console.warn('AudioContext init failed',e);}
  }
  async _load(key,url){
    try{
      const res=await fetch(url);
      const arr=await res.arrayBuffer();
      this.buffers[key]=await this.ctx.decodeAudioData(arr);
    }catch(e){console.warn('Audio load failed',url,e);}
  }
  _resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();}
  _play(key,loop,vol){
    if(this.muted||!this.ready||!this.buffers[key])return null;
    this._resume();
    const src=this.ctx.createBufferSource();
    src.buffer=this.buffers[key];src.loop=!!loop;
    const gain=this.ctx.createGain();gain.gain.value=vol;
    src.connect(gain);gain.connect(this.ctx.destination);
    src.start(0);
    return{src,gain};
  }
  playBackgroundMusic(){
    if(this.bgNode)return;
    const n=this._play('bg',true,0.28);
    if(n){this.bgNode=n.src;this.bgGain=n.gain;}
  }
  stopBackgroundMusic(){
    if(this.bgNode){try{this.bgNode.stop();}catch(e){}this.bgNode=null;this.bgGain=null;}
  }
  playGameOver(){this._play('over',false,0.55);}
  playSuccess(){this._play('success',false,0.55);}
  toggleMute(){this.setMute(!this.muted);}
  setMute(v){
    this.muted=!!v;localStorage.setItem("skybound-muted",this.muted?"1":"0");
    if(this.muted){if(this.bgGain)this.bgGain.gain.value=0;}
    else{if(this.bgGain)this.bgGain.gain.value=0.28;else if(game.state==="playing")this.playBackgroundMusic();}
  }
  pause(){if(this.bgGain)this.bgGain.gain.value=0;}
  resume(){if(!this.muted&&this.bgGain)this.bgGain.gain.value=0.28;}
}

class Player{
  constructor(image){this.image=image;this.reset()}
  reset(){this.x=CONFIG.player.x;this.y=340;this.vy=0;this.rotation=0;this.flapPhase=0}
  flap(){this.vy=CONFIG.player.flap;this.flapPhase=1}
  update(dt){
    this.vy=clamp(this.vy+CONFIG.player.gravity*game.gravityScale*dt,-999,CONFIG.player.maxFall);
    this.y+=this.vy*dt;
    this.rotation=lerp(this.rotation,clamp(this.vy/650,-.62,.95),Math.min(1,dt*9));
    this.flapPhase=Math.max(0,this.flapPhase-dt*7);
  }
  draw(ctx){
    const s=CONFIG.player.size;
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.rotation);
    if(this.image.complete&&this.image.naturalWidth){
      const bob=Math.sin(performance.now()/70)*this.flapPhase*2;
      const r=s/2;
      ctx.save();
      ctx.shadowColor="#58dcff";ctx.shadowBlur=18;
      ctx.beginPath();ctx.arc(0,bob,r,0,Math.PI*2);ctx.clip();
      ctx.drawImage(this.image,-r,-r+bob,s,s);
      ctx.restore();
      ctx.beginPath();ctx.arc(0,bob,r,0,Math.PI*2);
      ctx.strokeStyle="#ffffffaa";ctx.lineWidth=2.5;ctx.stroke();
    }else{
      // Fallback makes the game playable even if player.png has not been supplied yet.
      ctx.shadowColor="#58dcff";ctx.shadowBlur=18;ctx.fillStyle="#ffd45b";
      ctx.beginPath();ctx.ellipse(0,0,s*.48,s*.38,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s*.18,-s*.1,5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#18243a";ctx.beginPath();ctx.arc(s*.22,-s*.1,2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ff8d36";ctx.beginPath();ctx.moveTo(s*.43,0);ctx.lineTo(s*.68,5);ctx.lineTo(s*.43,9);ctx.closePath();ctx.fill();
      ctx.fillStyle="#7adfff";ctx.beginPath();ctx.ellipse(-7,8,11,5,-.35,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  bounds(){const r=CONFIG.player.size/2-4;return {l:this.x-r,r:this.x+r,t:this.y-r,b:this.y+r}}
}

class Obstacle{
  constructor(x,gapY,gapH){this.x=x;this.gapY=gapY;this.gapH=gapH;this.passed=false}
  update(dt){this.x-=game.speed*dt}
  draw(ctx){
    const w=CONFIG.obstacles.width, top=0, bottom=CONFIG.world.h-CONFIG.world.ground;
    drawPipe(ctx,this.x,top,w,this.gapY);
    drawPipe(ctx,this.x,this.gapY+this.gapH,w,bottom-(this.gapY+this.gapH));
  }
  collides(p){
    const b=p.bounds(), x1=this.x-5,x2=this.x+CONFIG.obstacles.width+5;
    if(b.r<x1||b.l>x2)return false;
    return b.t<this.gapY || b.b>this.gapY+this.gapH;
  }
}
function drawPipe(ctx,x,y,w,h){
  if(h<=0)return;
  const cap=10;
  const grad=ctx.createLinearGradient(x,y,x+w,y);
  grad.addColorStop(0,"#197a35");grad.addColorStop(.18,"#42d15b");grad.addColorStop(.52,"#27ad47");grad.addColorStop(1,"#11672c");
  ctx.fillStyle=grad;ctx.fillRect(x,y,w,h);
  ctx.fillStyle="#ffffff18";ctx.fillRect(x+8,y,5,h);
  const cy=y===0?y+h-cap:y;
  ctx.fillStyle="#176d31";ctx.fillRect(x-6,cy,w+12,cap);
  ctx.fillStyle="#56e56655";ctx.fillRect(x,cy+2,w,3);
}

class ParticleSystem{
  constructor(){this.items=[]}
  burst(x,y,n=38){for(let i=0;i<n&&this.items.length<180;i++)this.items.push({x,y,vx:rand(-180,180),vy:rand(-300,40),life:rand(.5,1.2),size:rand(2,5),rot:rand(0,6.2)})}
  update(dt){for(const p of this.items){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;p.rot+=dt*5}this.items=this.items.filter(p=>p.life>0)}
  draw(ctx){for(const p of this.items){ctx.save();ctx.globalAlpha=clamp(p.life,0,1);ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.life>.8?"#ffe36e":"#63dfff";ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.8);ctx.restore()}}
}

class Background{
  constructor(){this.far=0;this.mid=0;this.near=0;this.ground=0;this.stars=[];for(let i=0;i<55;i++)this.stars.push({x:rand(0,CONFIG.world.w),y:rand(20,430),r:rand(.5,1.7),a:rand(.35,1)})}
  update(dt){if(game.state==="playing"){this.far+=game.speed*.08*dt;this.mid+=game.speed*.18*dt;this.near+=game.speed*.35*dt;this.ground+=game.speed*dt}}
  draw(ctx){
    const W=CONFIG.world.w,H=CONFIG.world.h,G=CONFIG.world.ground;
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#06132f");sky.addColorStop(.58,"#12386a");sky.addColorStop(1,"#25648b");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // moon + glow
    const mg=ctx.createRadialGradient(345,130,4,345,130,75);mg.addColorStop(0,"#fffbd5aa");mg.addColorStop(1,"#fffbd500");ctx.fillStyle=mg;ctx.fillRect(270,55,150,150);
    ctx.fillStyle="#fff6c7";ctx.beginPath();ctx.arc(345,130,25,0,Math.PI*2);ctx.fill();
    for(const s of this.stars){ctx.globalAlpha=s.a*(.65+.35*Math.sin(performance.now()/700+s.x));ctx.fillStyle="#dff7ff";ctx.beginPath();ctx.arc((s.x-this.far*.05)%W,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    this.clouds(ctx,W);
    mountainLayer(ctx,430,170,this.far,"#183d65",.018);
    mountainLayer(ctx,500,145,this.mid,"#15516b",.026);
    mountainLayer(ctx,570,110,this.near,"#14625d",.035);
    // distant haze
    ctx.fillStyle="#54c58d22";ctx.fillRect(0,560,W,80);
    ctx.fillStyle="#175d39";ctx.fillRect(0,H-G,W,G);
    ctx.fillStyle="#2c8a46";for(let x=-(this.ground%24);x<W+24;x+=24){ctx.fillRect(x,H-G,14,4);ctx.fillRect(x+8,H-G-5,3,7)}
    ctx.fillStyle="#0e482d";ctx.fillRect(0,H-G,W,8);
  }
  clouds(ctx,W){ctx.fillStyle="#b7eaff18";for(let i=0;i<4;i++){let x=((i*160-this.mid*.07)%(W+190)+W+190)%(W+190)-95,y=220+i*75;ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.arc(x+22,y-8,23,0,Math.PI*2);ctx.arc(x+47,y,16,0,Math.PI*2);ctx.fill()}}
}
function mountainLayer(ctx,base,amp,off,color,rate){const W=CONFIG.world.w;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,base+120);for(let x=-30;x<=W+30;x+=18){const n=Math.sin(x*.024+off*rate)+.45*Math.sin(x*.053+off*rate*1.7);ctx.lineTo(x,base-amp*n)}ctx.lineTo(W,800);ctx.lineTo(0,800);ctx.closePath();ctx.fill()}

class CollisionManager{
  static check(){const p=game.player,b=p.bounds(),H=CONFIG.world.h,G=CONFIG.world.ground;if(b.t<=0||b.b>=H-G)return true;return game.obstacles.some(o=>o.collides(p))}
}

class Game{
  constructor(){
    this.canvas=document.getElementById("gameCanvas");this.ctx=this.canvas.getContext("2d",{alpha:false});
    this.playerImg=new Image();this.playerImg.src=CONFIG.assets.player;
    this.player=new Player(this.playerImg);this.audio=new AudioManager(CONFIG.audio);this.particles=new ParticleSystem();this.background=new Background();
    this.state="start";this.score=0;this.best=Number(localStorage.getItem("skybound-best")||0);this.obstacles=[];this.speed=CONFIG.obstacles.speed;this.gravityScale=1;this.last=performance.now();this.acc=0;
    this.resize();this.bind();this.updateUI();requestAnimationFrame(t=>this.loop(t));
  }
  resize(){const dpr=Math.min(devicePixelRatio||1,2),r=this.canvas.getBoundingClientRect();this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.scaleX=r.width/CONFIG.world.w;this.scaleY=r.height/CONFIG.world.h}
  bind(){
    window.addEventListener("resize",()=>this.resize());
    const flap=e=>{if(e.cancelable)e.preventDefault();if(this.state==="playing")this.player.flap();else if(this.state==="start")this.start()};
    this.canvas.addEventListener("pointerdown",flap,{passive:false});
    window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();flap(e)} if(e.code==="KeyP")this.togglePause()});
    playBtn.onclick=()=>this.start();retryBtn.onclick=()=>this.start();winRetryBtn.onclick=()=>this.start();
    gameOverHomeBtn.onclick=()=>this.home();winHomeBtn.onclick=()=>this.home();resumeBtn.onclick=()=>this.resume();pauseRestartBtn.onclick=()=>this.start();pauseHomeBtn.onclick=()=>this.home();
    soundBtn.onclick=()=>{this.audio.toggleMute();this.updateUI()};
    pauseBtn.onclick=()=>this.togglePause();
  }
  start(){
    this.state="playing";this.score=0;this.speed=CONFIG.obstacles.speed;this.gravityScale=1;this.obstacles=[];this.player.reset();this.acc=0;
    this.hideOverlays();this.audio.stopBackgroundMusic();this.audio.playBackgroundMusic();this.spawn(CONFIG.obstacles.startX);this.spawn(CONFIG.obstacles.startX+CONFIG.obstacles.spacing);this.updateUI();
  }
  home(){this.state="start";this.audio.stopBackgroundMusic();this.player.reset();this.obstacles=[];this.hideOverlays();startOverlay.classList.add("visible");this.updateUI()}
  spawn(x){const gap=this.gapSize();const min=110,max=CONFIG.world.h-CONFIG.world.ground-gap-85;this.obstacles.push(new Obstacle(x,rand(min,max),gap))}
  gapSize(){return clamp(CONFIG.obstacles.baseGap-this.score*2.1,CONFIG.obstacles.minGap,CONFIG.obstacles.baseGap)}
  togglePause(){if(this.state==="playing"){this.state="paused";this.audio.pause();pauseOverlay.classList.add("visible")}else if(this.state==="paused")this.resume()}
  resume(){if(this.state!=="paused")return;this.state="playing";pauseOverlay.classList.remove("visible");this.audio.resume()}
  lose(){if(this.state!=="playing")return;this.state="gameover";this.audio.stopBackgroundMusic();this.audio.playGameOver();this.particles.burst(this.player.x,this.player.y,28);this.best=Math.max(this.best,this.score);localStorage.setItem("skybound-best",this.best);finalScore.textContent=this.score;finalBest.textContent=this.best;gameOverOverlay.classList.add("visible");this.updateUI()}
  win(){if(this.state!=="playing")return;this.state="win";this.audio.stopBackgroundMusic();this.audio.playSuccess();this.particles.burst(this.player.x,this.player.y,90);winScore.textContent=this.score;winOverlay.classList.add("visible");this.best=Math.max(this.best,this.score);localStorage.setItem("skybound-best",this.best);this.updateUI()}
  scorePoint(){this.score++;this.best=Math.max(this.best,this.score);localStorage.setItem("skybound-best",this.best);this.updateUI();toast.classList.remove("pop");void toast.offsetWidth;toast.classList.add("pop");if(this.score>=CONFIG.winScore)this.win()}
  update(dt){this.background.update(dt);this.particles.update(dt);if(this.state!=="playing")return;this.player.update(dt);this.speed=CONFIG.obstacles.speed+Math.min(85,this.score*3.1);this.gravityScale=1+Math.min(.13,this.score*.006);for(const o of this.obstacles)o.update(dt);
    const last=this.obstacles[this.obstacles.length-1];if(!last||last.x<CONFIG.world.w-CONFIG.obstacles.spacing)this.spawn(CONFIG.obstacles.startX);
    for(const o of this.obstacles){if(!o.passed&&o.x+CONFIG.obstacles.width<this.player.x){o.passed=true;this.scorePoint();if(this.state!=="playing")break}}
    this.obstacles=this.obstacles.filter(o=>o.x>-CONFIG.obstacles.width-20);if(this.state==="playing"&&CollisionManager.check())this.lose();
  }
  draw(){const ctx=this.ctx;const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr*this.scaleX,0,0,dpr*this.scaleY,0,0);this.background.draw(ctx);for(const o of this.obstacles)o.draw(ctx);this.particles.draw(ctx);this.player.draw(ctx)}
  loop(now){const dt=Math.min(.033,(now-this.last)/1000);this.last=now;this.update(dt);this.draw();requestAnimationFrame(t=>this.loop(t))}
  hideOverlays(){document.querySelectorAll(".overlay").forEach(x=>x.classList.remove("visible"))}
  updateUI(){score.textContent=this.score;startBest.textContent=this.best;soundBtn.textContent=this.audio.muted?"🔇":"🔊";soundBtn.setAttribute("aria-label",this.audio.muted?"Sound off":"Sound on")}
}
const game=new Game();
