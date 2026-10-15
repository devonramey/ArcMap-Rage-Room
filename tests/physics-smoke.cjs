/* Executed on GitHub Actions with the real vendored Planck engine. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const P=require('../vendor/planck.min.js');
assert.ok(P.World&&P.RevoluteJoint&&P.MouseJoint,'Planck exports must be available');
global.window={planck:P};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../arcmap_physics_v7.js'),'utf8'),{filename:'arcmap_physics_v7.js'});
const eng=global.window.ArcV7Physics;
const game={body:{x:640,y:327,vx:0,vy:0,a:0,va:0},sizeFactor:1,gravityLow:false,stasisTime:0,destroyed:false,drag:null,time:0,fragments:[],limbs:[]};
const specs=[['arm','L',-108,-42,-139,-6,-171,29,44,45],['arm','R',108,-42,139,-6,171,29,44,45],['leg','L',-70,55,-76,106,-89,147,52,46],['leg','R',70,55,76,106,89,147,52,46]];
for(const [type,side,ax,ay,mx,my,ex,ey,len1,len2] of specs){
 const a={x:game.body.x+mx,y:game.body.y+my},b={x:game.body.x+ex,y:game.body.y+ey};
 game.limbs.push({type,side,ax,ay,len1,len2,a,b,detached:false});
}
eng.reset(game);
assert.equal(eng.enabled,true,'Planck initialization');
assert.equal(eng.limbs.length,4,'Four limbs, eight rigid segments');
assert.equal(eng.partBodies.size,9,'Torso plus eight limb segments');
assert.equal(eng.step(game,1/60),true,'Physics step');
assert.ok(game.body.y>327,'Gravity should change position');
const hit=eng.rayHit({prevX:200,prevY:327,x:790,y:327,r:5});
assert.ok(hit,'Projectile must raycast to target');
assert.equal(hit.part,'torso','Center shot should identify torso');
assert.equal(eng.rayHit({prevX:200,prevY:160,x:1000,y:160,r:3}),null,'Shot above character must miss');
const knife=eng.embeddedKnife({...hit,vx:1350,vy:0});assert.ok(knife);
const loc=eng.knifeTransform(knife);assert.ok(Math.abs(loc.x-hit.x)<.01 && Math.abs(loc.y-hit.y)<.01,'Knife must stick at local hit point');
const initialY=game.body.y;
eng.impulseAt(0,-1600,hit.x,hit.y,hit.part);
for(let i=0;i<6;i++){game.time+=1/60;assert.equal(eng.step(game,1/60),true,eng.error)}
assert.ok(game.body.y<initialY+10,'Impulse should affect torso momentum');
const limb=eng.limbs[0].limb;
limb.detached=true;eng.step(game,1/60);
assert.equal(eng.limbs[0].detached,true,'Physical joint detaches');
game.drag={type:'body',x:650,y:240,offX:0,offY:0,vx:0,vy:0};
eng.step(game,1/60);eng.releaseDrag(game.drag);game.drag=null;
assert.equal(eng.mouseJoint,null,'Mouse joint released');
game.fragments=Array.from({length:12},(_,i)=>({x:540+i*8,y:300,vx:(i-6)*30,vy:-200,a:0,va:0,w:57.5,h:44.7}));game.destroyed=true;
assert.equal(eng.step(game,1/60),true,eng.error);
assert.equal(eng.fragBodies.length,12,'Twelve real fragment rigid bodies');
assert.ok(game.fragments.every(f=>f.rigid),'Each fragment has its own rigid body');
eng.step(game,1/60);
console.log('PASS: Planck ragdoll, segment sweep, local knife embed, impulse, detached limb, mouse drag and 12 rigid fragments');