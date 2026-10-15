/* ArcMap Rage Room v7: Planck.js rigid-body simulation.
   Copyright (c) 2026 ArcMap Rage Room contributors.
   Relies on the MIT-licensed Planck.js engine, distributed separately in vendor/.
   The game uses metres internally (54 pixels = 1 metre). */
(function () {
  'use strict';
  const P = window.planck;
  const SCALE = 54, W = 1280, H = 720;
  const clamp = (n,a,b) => Math.max(a,Math.min(n,b));
  class ArcV7Physics {
    constructor() {
      this.enabled = false;
      this.world = null;
      this.partBodies = new Map();
      this.members = new Map();
      this.limbs = [];
      this.fragBodies = [];
      this.lastSnapshot = null;
      this.mouseJoint = null;
      this.mouseTarget = null;
      this.contacts = [];
      this.lastImpact = -10;
      this.destructionStarted = false;
      this.error = '';
    }
    v(x,y) {return P.Vec2(x,y)}
    px(x,y) {return this.v(x/SCALE,y/SCALE)}
    reset(game) {
      this.enabled = false; this.world = null; this.partBodies.clear(); this.members.clear();
      this.limbs = []; this.fragBodies = []; this.contacts = [];
      this.mouseJoint = null; this.mouseTarget = null; this.lastSnapshot = null;
      this.destructionStarted = false;
      if (!P || !P.World || !P.Box || !P.Vec2 || !P.RevoluteJoint) {
        this.error = 'Planck.js library is unavailable'; return;
      }
      try {
        const world = new P.World({gravity:this.v(0,17)});
        this.world=world;
        this.wall=world.createBody();
        const addWall=(x,y,hx,hy)=>this.wall.createFixture(P.Box(hx,hy,P.Vec2(x,y),0),{friction:.78,restitution:.30});
        addWall(W/(2*SCALE),665/SCALE,W/(2*SCALE),.25);
        addWall(W/(2*SCALE),141/SCALE,W/(2*SCALE),.17);
        addWall(.20,7.45,.26,8.6);addWall(W/SCALE-.20,7.45,.26,8.6);
        const size=game.sizeFactor||1, b=game.body;
        this.torso=world.createDynamicBody({position:this.px(b.x,b.y),angle:b.a||0,linearDamping:.36,angularDamping:1.0,bullet:true});
        this.torso.createFixture(P.Box(111*size/SCALE,65*size/SCALE),{density:1.9,friction:.62,restitution:.38});
        this.register('torso',this.torso,{kind:'torso'});
        this.torso.setLinearVelocity(this.px(b.vx||0,b.vy||0));this.torso.setAngularVelocity(b.va||0);
        game.limbs.forEach(limb=>{
          const tag=limb.type+'-'+limb.side.toLowerCase();
          const at={x:b.x+limb.ax*size,y:b.y+limb.ay*size};
          const pivot={x:limb.a.x,y:limb.a.y}, tip={x:limb.b.x,y:limb.b.y};
          const make=(a,z,part)=>{
            const x=(a.x+z.x)/2,y=(a.y+z.y)/2;
            const angle=Math.atan2(z.y-a.y,z.x-a.x);
            const length=Math.max(10,Math.hypot(z.x-a.x,z.y-a.y));
            const rb=world.createDynamicBody({position:this.px(x,y),angle,linearDamping:.42,angularDamping:1.2,bullet:true});
            rb.createFixture(P.Box(length/(2*SCALE),Math.max(.11,.13*size)),{density:1.35,friction:.66,restitution:.30,filterGroupIndex:-1});
            this.register(part,rb,{kind:'limb',limb});return rb;
          };
          const upper=make(at,pivot,tag+'-upper'),lower=make(pivot,tip,tag+'-lower');
          const shoulder=world.createJoint(P.RevoluteJoint({collideConnected:false,enableLimit:true,lowerAngle:-2.75,upperAngle:2.75},this.torso,upper,this.px(at.x,at.y)));
          const elbow=world.createJoint(P.RevoluteJoint({collideConnected:false,enableLimit:true,lowerAngle:-2.65,upperAngle:2.65},upper,lower,this.px(pivot.x,pivot.y)));
          this.limbs.push({limb,upper,lower,shoulder,elbow,detached:false,upperLength:Math.hypot(pivot.x-at.x,pivot.y-at.y),lowerLength:Math.hypot(tip.x-pivot.x,tip.y-pivot.y)});
          this.members.set(limb.a,upper);this.members.set(limb.b,lower);
        });
        world.on('post-solve',(contact,impulses)=>{
          const a=contact.getFixtureA().getBody(),b=contact.getFixtureB().getBody();
          if(a!==this.wall&&b!==this.wall)return;
          const dyn=a===this.wall?b:a;
          if(!dyn.isDynamic())return;
          const speed=impulses.normalImpulses?.[0]||0;
          if(speed>.6){const p=dyn.getPosition();this.contacts.push({x:p.x*SCALE,y:p.y*SCALE,strength:speed});}
        });
        this.scale=size;this.enabled=true;this.error='';this.snapshot(game);
      } catch(error) {
        this.enabled=false;this.error=String(error);console.error('Planck v7 init failed',error);
      }
    }
    register(part,body,meta){body.setUserData({part,...meta});this.partBodies.set(part,body)}
    snapshot(game){this.lastSnapshot={x:game.body.x,y:game.body.y,vx:game.body.vx,vy:game.body.vy,scale:game.sizeFactor}}
    bodyForDrag(d){
      if(!d)return null;
      if(d.type==='body')return this.torso;
      if(d.type==='node')return this.members.get(d.node)||null;
      if(d.type==='fragment')return d.frag?.rigid||null;
      return null;
    }
    clearDrag(){
      if(this.mouseJoint && this.world){this.world.destroyJoint(this.mouseJoint);}
      this.mouseJoint=null;this.mouseTarget=null;
    }
    releaseDrag(d){
      if(!this.enabled||!d)return;
      const rb=this.bodyForDrag(d);this.clearDrag();
      if(!rb)return;
      const vx=clamp(d.vx||0,-2000,2000)/SCALE,vy=clamp(d.vy||0,-1800,1800)/SCALE;
      rb.setLinearVelocity(this.v(vx,vy));rb.setAwake(true);
    }
    syncDrag(game){
      const d=game.drag,rb=this.bodyForDrag(d);
      if(!rb || game.stasisTime>0){this.clearDrag();return;}
      const target=this.px(d.x+(d.type==='body'?d.offX||0:0),d.y+(d.type==='body'?d.offY||0:0));
      if(this.mouseTarget!==rb){
        this.clearDrag();
        try {
          this.mouseJoint=this.world.createJoint(P.MouseJoint({maxForce:Math.max(60,rb.getMass()*1900),frequencyHz:13,dampingRatio:.82,target},this.wall,rb));
          this.mouseTarget=rb;
        }catch(error){console.warn('MouseJoint unavailable, applying velocity drag',error);this.mouseJoint=null;this.mouseTarget=rb;}
      }
      if(this.mouseJoint)this.mouseJoint.setTarget(target);
      else{const p=rb.getPosition();rb.setLinearVelocity(this.v(clamp((target.x-p.x)*30,-60,60),clamp((target.y-p.y)*30,-60,60)));}
      rb.setAwake(true);
    }
    impulse(ix,iy,rot=0){return this.impulseAt(ix,iy,null,null,'torso',rot)}
    impulseAt(ix,iy,x,y,part=null,rot=0){
      if(!this.enabled)return false;
      const rb=this.partBodies.get(part)||((x!==null&&y!==null)?this.bodyNear(x,y,105):null)||this.torso;
      if(!rb)return false;
      const pos= (x!==null&&y!==null)?this.px(x,y):rb.getWorldCenter();
      const mass=rb.getMass();
      rb.applyLinearImpulse(this.v(clamp(ix,-3400,3400)/SCALE*mass*.38,clamp(iy,-3400,3400)/SCALE*mass*.38),pos,true);
      if(rot)rb.applyAngularImpulse(rot*mass*.15,true);
      return true;
    }
    bodyNear(x,y,maxPx=110){
      const v=this.px(x,y);let best=null,dist=maxPx;
      for(const [part,body] of this.partBodies){
        if(!body)continue;
        const pos=body.getPosition(),distance=Math.hypot(pos.x-v.x,pos.y-v.y)*SCALE;
        if(distance<dist){best=body;dist=distance;}
      }
      return best;
    }
    rayHit(s){
      if(!this.enabled||!this.world||this.destructionStarted)return null;
      const start=this.v((s.prevX??s.x)/SCALE,(s.prevY??s.y)/SCALE),end=this.px(s.x,s.y);
      let best=null;
      const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1;
      const ox=-dy/length*(s.r||0)/SCALE*.65,oy=dx/length*(s.r||0)/SCALE*.65;
      for(const spread of [0,1,-1]){
        const from=this.v(start.x+ox*spread,start.y+oy*spread),to=this.v(end.x+ox*spread,end.y+oy*spread);
        if(Math.hypot(to.x-from.x,to.y-from.y)<.001)continue;
        this.world.rayCast(from,to,(fixture,point,normal,fraction)=>{
          const info=fixture.getBody().getUserData();
          if(!info?.part)return -1;
          if(!best||fraction<best.fraction){best={part:info.part,kind:info.kind,limb:info.limb||null,x:point.x*SCALE,y:point.y*SCALE,fraction,body:fixture.getBody()};}
          return fraction;
        });
      }
      return best;
    }
    embeddedKnife(hit){
      const rb=hit?.body||this.partBodies.get(hit?.part);if(!rb)return null;
      const loc=rb.getLocalPoint(this.px(hit.x,hit.y));
      return {part:hit.part,x:loc.x,y:loc.y,a:Math.atan2(hit.vy||0,hit.vx||1)-rb.getAngle(),createdAt:performance.now()};
    }
    knifeTransform(k){
      const rb=this.partBodies.get(k.part);if(!rb)return null;
      const pos=rb.getWorldPoint(this.v(k.x,k.y));return {x:pos.x*SCALE,y:pos.y*SCALE,a:rb.getAngle()+k.a};
    }
    syncExternal(game){
      const snap=this.lastSnapshot;if(!snap||!this.torso||this.destructionStarted)return;
      const b=game.body;
      // Special weapons such as Coordinate Scrambler modify the authored position directly.
      const dx=b.x-snap.x,dy=b.y-snap.y;
      if(Math.hypot(dx,dy)>25){
        for(const body of this.partBodies.values()){
          const at=body.getPosition();body.setTransform(this.v(at.x+dx/SCALE,at.y+dy/SCALE),body.getAngle());
        }
      }
      // Apply only changes introduced by special field/portal effects since the previous engine step.
      const dvx=b.vx-snap.vx,dvy=b.vy-snap.vy;
      if(Math.abs(dvx)+Math.abs(dvy)>1){const v=this.torso.getLinearVelocity();this.torso.setLinearVelocity(this.v(clamp(v.x+dvx/SCALE,-55,55),clamp(v.y+dvy/SCALE,-55,55)));}
      if(Math.abs((game.sizeFactor||1)-this.scale)>.03){
        // Rebuild collision shapes at new scale after special shrink/grow effects.
        const velocity=this.torso.getLinearVelocity(),angular=this.torso.getAngularVelocity();
        b.vx=velocity.x*SCALE;b.vy=velocity.y*SCALE;b.va=angular;
        this.reset(game);
      }
    }
    makeFragments(game){
      if(this.destructionStarted)return;
      this.destructionStarted=true;this.clearDrag();
      for(const f of game.fragments){
        const body=this.world.createDynamicBody({position:this.px(f.x,f.y),angle:f.a,linearDamping:.17,angularDamping:.65,bullet:true});
        body.createFixture(P.Box(Math.max(3,f.w/2)/SCALE,Math.max(3,f.h/2)/SCALE),{density:.76,friction:.63,restitution:.45});
        body.setLinearVelocity(this.px(f.vx,f.vy));body.setAngularVelocity(f.va||0);f.rigid=body;
        this.fragBodies.push({fragment:f,body});
      }
      for(const link of this.limbs){
        if(link.shoulder){this.world.destroyJoint(link.shoulder);link.shoulder=null;}
      }
      if(this.torso){this.world.destroyBody(this.torso);this.torso=null;}
      this.partBodies.clear();
    }
    sync(game){
      if(this.destructionStarted){
        for(const {fragment:f,body} of this.fragBodies){
          const p=body.getPosition(),v=body.getLinearVelocity();
          f.x=p.x*SCALE;f.y=p.y*SCALE;f.a=body.getAngle();f.vx=v.x*SCALE;f.vy=v.y*SCALE;f.va=body.getAngularVelocity();
        }
        for(const link of this.limbs){this.syncLink(link)}
        return;
      }
      const b=game.body,pos=this.torso.getPosition(),velocity=this.torso.getLinearVelocity();
      b.x=pos.x*SCALE;b.y=pos.y*SCALE;b.vx=velocity.x*SCALE;b.vy=velocity.y*SCALE;b.a=this.torso.getAngle();b.va=this.torso.getAngularVelocity();
      for(const link of this.limbs){
        if(link.limb.detached && !link.detached){
          if(link.shoulder){this.world.destroyJoint(link.shoulder);link.shoulder=null;}
          link.detached=true;
        }
        this.syncLink(link);
      }
      this.snapshot(game);
    }
    syncLink({limb,upper,lower,upperLength,lowerLength}){
      const a=upper.getWorldPoint(this.v(upperLength/(2*SCALE),0));
      const b=lower.getWorldPoint(this.v(lowerLength/(2*SCALE),0));
      limb.a.x=a.x*SCALE;limb.a.y=a.y*SCALE;limb.a.ox=limb.a.x;limb.a.oy=limb.a.y;
      limb.b.x=b.x*SCALE;limb.b.y=b.y*SCALE;limb.b.ox=limb.b.x;limb.b.oy=limb.b.y;
    }
    step(game,dt){
      if(!this.enabled||!this.world)return false;
      try{
        if(game.destroyed){this.makeFragments(game);}else{this.syncExternal(game)}
        this.world.setGravity(this.v(0,game.gravityLow?4.5:17));
        this.syncDrag(game);
        if(game.stasisTime>0 && this.torso){this.torso.setLinearVelocity(this.v(0,0));this.torso.setAngularVelocity(0)}
        for(let i=0,n=Math.max(1,Math.ceil(dt/(1/90)));i<n;i++)this.world.step(dt/n,12,6);
        for(const contact of this.contacts){
          if(contact.strength>3 && game.time-this.lastImpact>.16){
            this.lastImpact=game.time;
            window.ArcV7WallImpact?.(contact.x,contact.y,contact.strength);
          }
        }
        this.contacts.length=0;
        this.sync(game);
        return true;
      }catch(error){this.error=String(error);console.error('Planck v7 step failed; reverting to fallback',error);this.enabled=false;return false;}
    }
  }
  window.ArcV6Physics=new ArcV7Physics();
  window.ArcV7Physics=window.ArcV6Physics;
})();