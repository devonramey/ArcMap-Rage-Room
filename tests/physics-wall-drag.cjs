/* Regressions for wall tunneling while held and floppy-limb joint locking. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../vendor/planck.min.js');
global.window={planck:P};
vm.runInThisContext(fs.readFileSync(path.resolve(__dirname,'../arcmap_physics_v7.js'),'utf8'),{filename:'arcmap_physics_v7.js'});
const eng=window.ArcV7Physics;
const game={body:{x:640,y:327,vx:0,vy:0,a:0,va:0},sizeFactor:1,gravityLow:false,stasisTime:0,destroyed:false,drag:null,time:0,fragments:[],limbs:[]};
const specs=[['arm','L',-108,-42,-139,-6,-171,29,44,45],['arm','R',108,-42,139,-6,171,29,44,45],['leg','L',-70,55,-76,106,-89,147,52,46],['leg','R',70,55,76,106,89,147,52,46]];
for(const [type,side,ax,ay,mx,my,ex,ey,len1,len2] of specs){
  game.limbs.push({type,side,ax,ay,len1,len2,
    a:{x:640+mx,y:327+my},b:{x:640+ex,y:327+ey},detached:false});
}
function tick(n=1){for(let i=0;i<n;i++){game.time+=1/60;assert.equal(eng.step(game,1/60),true,eng.error)}}
function inBounds(body,slop=5){
 const e=eng.dragExtent(body),p=body.getPosition(),r=eng.room;
 return p.x*54-e.x>=r.left-slop&&p.x*54+e.x<=r.right+slop&&
        p.y*54-e.y>=r.top-slop&&p.y*54+e.y<=r.bottom+slop;
}
eng.reset(game);assert.equal(eng.enabled,true);
let dragSteps=0;
for(const [x,y] of [[-1200,320],[2300,320],[640,-800],[640,1400],[-1200,-1000],[2300,1450]]){
  game.drag={type:'body',x,y,offX:0,offY:0,vx:0,vy:0};
  for(let i=0;i<140;i++){
    tick();dragSteps++;
    if(i%25===0)console.log('DRAG SAMPLE',JSON.stringify({i,target:[x,y],pos:eng.torso.getPosition(),angle:eng.torso.getAngle(),joint:!!eng.mouseJoint,clamped:eng.debugLastDragTarget}));
    const wanted=eng.debugLastDragTarget,r=eng.room;
    assert.ok(wanted.x>=r.left&&wanted.x<=r.right&&wanted.y>=r.top&&wanted.y<=r.bottom,'Drag target outside physical room');
    assert.ok(inBounds(eng.torso,7),'Body crossed room wall while held: '+JSON.stringify({target:[x,y],pos:eng.torso.getPosition(),extent:eng.dragExtent(eng.torso)}));
  }
  eng.releaseDrag(game.drag);game.drag=null;tick(25);
}
game.drag={type:'node',node:game.limbs[0].b,x:-1500,y:200,vx:0,vy:0};
tick(120);assert.ok(inBounds(eng.torso,7),'Dragging a hand should not pull torso through a wall');
eng.releaseDrag(game.drag);game.drag=null;
const samples=[];
for(let cycle=0;cycle<7;cycle++){
 eng.impulse((cycle%2?1:-1)*2400,-1600,(cycle%2?1:-1)*19);
 tick(100);
 for(const link of eng.limbs){
   const shoulder=link.shoulder?.getJointAngle()||0,elbow=link.elbow?.getJointAngle()||0;
   samples.push([shoulder,elbow]);
   if(cycle===0||Math.abs(shoulder)>2.08||Math.abs(elbow)>2.27)console.log('JOINT SAMPLE',JSON.stringify({cycle,part:link.limb.type+link.limb.side,shoulder,elbow,bodyAngle:eng.torso.getAngle(),velocity:eng.torso.getAngularVelocity()}));
   assert.ok(Number.isFinite(shoulder)&&Number.isFinite(elbow),'Joint angles must remain finite');
   assert.ok(Math.abs(shoulder)<2.1,'Shoulder locked beyond allowable range');
   assert.ok(Math.abs(elbow)<2.31,'Elbow/knee locked beyond allowable range');
   assert.ok(Number.isFinite(link.limb.b.x)&&Number.isFinite(link.limb.b.y),'Limbs must keep finite world positions');
 }
}
const maxShoulder=Math.max(...samples.map(s=>Math.abs(s[0])));
const maxElbow=Math.max(...samples.map(s=>Math.abs(s[1])));
console.log('PASS wall-drag ragdoll regression:',JSON.stringify({dragSteps,postThrowCycles:7,maxShoulder,maxElbow,torso:{x:game.body.x,y:game.body.y}}));
