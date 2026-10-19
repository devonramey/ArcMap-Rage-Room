/* ArcMap Rage Room v7.1: corrected Planck ragdoll walls and joints.
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
      this.fragmentSnapshots = new Map();
      this.lastSnapshot = null;
      this.mouseJoint = null;
      this.mouseTarget = null;
      this.dragBody = null;
      this.debugLastDragTarget = null;
      this.dragMaxSpeed = 0;
      this.contacts = [];
      this.lastImpact = -10;
      this.destructionStarted = false;
      this.error = '';
    }
    v(x,y) {return P.Vec2(x,y)}
    px(x,y) {return this.v(x/SCALE,y/SCALE)}
    reset(game) {
      this.enabled = false; this.world = null; this.partBodies.clear(); this.members.clear();
      this.limbs = []; this.fragBodies = []; this.fragmentSnapshots.clear(); this.contacts = [];
      this.mouseJoint = null; this.mouseTarget = null; this.dragBody = null; this.debugLastDragTarget = null; this.dragMaxSpeed=0; this.lastSnapshot = null;
      this.destructionStarted = false;
      if (!P || !P.World || !P.Box || !P.Vec2 || !P.RevoluteJoint) {
        this.error = 'Planck.js library is unavailable'; return;
      }
      try {
        const world = new P.World({gravity:this.v(0,17)});
        // Fixed collision boundaries are shared by the mouse-drag target limiter.
        this.room={left:25, right:W-25, top:151, bottom:651};
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
          const shoulder=world.createJoint(P.RevoluteJoint({collideConnected:false,enableLimit:true,lowerAngle:-1.95,upperAngle:1.95,enableMotor:true,maxMotorTorque:0,motorSpeed:0},this.torso,upper,this.px(at.x,at.y)));
          const elbow=world.createJoint(P.RevoluteJoint({collideConnected:false,enableLimit:true,lowerAngle:-2.15,upperAngle:2.15,enableMotor:true,maxMotorTorque:0,motorSpeed:0},upper,lower,this.px(pivot.x,pivot.y)));
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
      this.mouseJoint=null;this.mouseTarget=null;this.dragBody=null;
    }
    releaseDrag(d){
      if(!this.enabled||!d)return;
      const rb=this.bodyForDrag(d);this.clearDrag();
      if(!rb)return;
      // Keep the throw lively but prevent an excessive post-drag velocity spike.
      const vx=clamp(d.vx||0,-1250,1250)/SCALE,vy=clamp(d.vy||0,-1150,1150)/SCALE;
      rb.setLinearVelocity(this.v(vx,vy));rb.setAwake(true);
    }
    dragExtent(rb){
      // Bounding half-extents in world pixels, including angle, for a collision-safe
      // mouse target.  These are physical fixture bounds, not sprite drawing bounds.
      let halfWidth=14,halfHeight=14;
      if(rb===this.torso){halfWidth=111*this.scale;halfHeight=65*this.scale;}
      else if(rb.getUserData()?.kind==='limb'){
        const part=rb.getUserData().part||'';
        const isLower=part.endsWith('-lower');
        const link=this.limbs.find(l=>part.startsWith(l.limb.type+'-'+l.limb.side.toLowerCase()));
        halfWidth=(link?(isLower?link.lowerLength:link.upperLength)/2:24)*this.scale;
        halfHeight=Math.max(.11,.13*this.scale)*SCALE;
      }else if(rb.getUserData()?.kind==='fragment'){
        halfWidth=15;halfHeight=15;
      }
      const c=Math.abs(Math.cos(rb.getAngle())),s=Math.abs(Math.sin(rb.getAngle()));
      return {x:halfWidth*c+halfHeight*s,y:halfWidth*s+halfHeight*c};
    }
    clampDragTarget(rb,p){
      // Don't request a physically impossible mouse position inside a static wall.
      // This stops the very stiff mouse joint from pulling the torso THROUGH a wall.
      const e=this.dragExtent(rb),margin=18,r=this.room;
      const minX=(r.left+e.x+margin)/SCALE,maxX=(r.right-e.x-margin)/SCALE;
      const minY=(r.top+e.y+margin)/SCALE,maxY=(r.bottom-e.y-margin)/SCALE;
      return this.v(clamp(p.x,minX,maxX),clamp(p.y,minY,maxY));
    }
    syncDrag(game){
      const d=game.drag,rb=this.bodyForDrag(d);
      if(!rb || game.stasisTime>0){this.clearDrag();return;}
      const wanted=this.px(d.x+(d.type==='body'?d.offX||0:0),d.y+(d.type==='body'?d.offY||0:0));
      const target=this.clampDragTarget(rb,wanted);
      this.debugLastDragTarget={x:target.x*SCALE,y:target.y*SCALE};
      if(this.mouseTarget!==rb){
        this.clearDrag();
        try {
          // Lower force + critical damping preserve solid contacts against room walls.
          // High-force 13 Hz dragging previously overwhelmed the collision solver.
          // CRITICAL: Planck builds the body's LOCAL grab anchor from the
          // target supplied at joint construction.  Using the cursor position
          // here anchors a point OUTSIDE the body when dragged far or rapidly.
          // Anchor to the current rigid-body center first, THEN move target.
          const anchor=rb.getWorldCenter();
          this.mouseJoint=this.world.createJoint(P.MouseJoint({
            maxForce:Math.max(35,rb.getMass()*245),frequencyHz:6,dampingRatio:1,
            target:anchor
          },this.wall,rb));
          this.mouseJoint.setTarget(target);
          this.mouseTarget=rb;
        }catch(error){
          console.warn('MouseJoint unavailable, applying capped velocity drag',error);
          this.mouseJoint=null;this.mouseTarget=rb;
        }
      }
      if(this.mouseJoint)this.mouseJoint.setTarget(target);
      else{
        const p=rb.getPosition();
        rb.setLinearVelocity(this.v(clamp((target.x-p.x)*12,-13,13),clamp((target.y-p.y)*12,-13,13)));
      }
      rb.setAwake(true);
    }
    containDraggedBody(game) {
      // A fast drag can briefly defeat contact resolution at grazing angles.
      // While held, project the torso's oriented shape back inside the physical
      // room and discard only velocity directed further through a boundary.
      if(!game.drag||!this.torso||this.destructionStarted)return;
      const rb=this.torso,center=rb.getPosition(),e=this.dragExtent(rb),r=this.room;
      const clearance=3;
      const left=(r.left+e.x+clearance)/SCALE,right=(r.right-e.x-clearance)/SCALE;
      const top=(r.top+e.y+clearance)/SCALE,bottom=(r.bottom-e.y-clearance)/SCALE;
      const x=clamp(center.x,left,right),y=clamp(center.y,top,bottom);
      if(Math.abs(x-center.x)<.0002&&Math.abs(y-center.y)<.0002)return;
      rb.setTransform(this.v(x,y),rb.getAngle());
      const v=rb.getLinearVelocity();
      const vx=(center.x<left&&v.x<0)||(center.x>right&&v.x>0)?0:v.x;
      const vy=(center.y<top&&v.y<0)||(center.y>bottom&&v.y>0)?0:v.y;
      rb.setLinearVelocity(this.v(vx,vy));rb.setAwake(true);
    }
    stabilizeLimbs(game) {
      // Gentle, torque-limited joint-centering only when splayed far from the
      // original pose. Avoid forced angular motors on an actively dragged limb.
      for(const link of this.limbs){
        if(link.detached||link.limb.detached)continue;
        for(const [joint,threshold,mass] of [
          [link.shoulder,.72,link.upper.getMass()],
          [link.elbow,.95,link.lower.getMass()]
        ]){
          if(!joint)continue;
          const dragged=game.drag?.type==='node'&&
            (game.drag.node===link.limb.a||game.drag.node===link.limb.b);
          if(dragged){joint.setMaxMotorTorque(0);continue;}
          const angle=joint.getJointAngle(),rate=joint.getJointSpeed();
          const beyond=Math.abs(angle)-threshold;
          if(beyond>0){
            const desired=clamp(-Math.sign(angle)*beyond*3.0-rate*.45,-4,4);
            joint.setMotorSpeed(desired);
            joint.setMaxMotorTorque(Math.min(18,Math.max(1.5,mass*5.0)));
          }else joint.setMaxMotorTorque(0);
        }
      }
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
        this.fragmentSnapshots.set(f,{x:f.x,y:f.y,vx:f.vx,vy:f.vy,va:f.va});
      }
      for(const link of this.limbs){
        if(link.shoulder){this.world.destroyJoint(link.shoulder);link.shoulder=null;}
      }
      if(this.torso){this.world.destroyBody(this.torso);this.torso=null;}
      this.partBodies.clear();
    }
    syncFragmentEffects(){
      // The preexisting black-hole, vortex and impact systems add velocity to
      // fragment model values. Apply those deltas to their Planck bodies.
      for(const {fragment:f,body} of this.fragBodies){
        const old=this.fragmentSnapshots.get(f);if(!old)continue;
        const v=body.getLinearVelocity();
        const dvx=(f.vx-old.vx)/SCALE,dvy=(f.vy-old.vy)/SCALE;
        if(Math.abs(dvx)+Math.abs(dvy)>.01)body.setLinearVelocity(this.v(clamp(v.x+dvx,-70,70),clamp(v.y+dvy,-70,70)));
        if(Math.hypot(f.x-old.x,f.y-old.y)>35){body.setTransform(this.px(f.x,f.y),body.getAngle());}
      }
    }
    sync(game){
      if(this.destructionStarted){
        for(const {fragment:f,body} of this.fragBodies){
          const p=body.getPosition(),v=body.getLinearVelocity();
          f.x=p.x*SCALE;f.y=p.y*SCALE;f.a=body.getAngle();f.vx=v.x*SCALE;f.vy=v.y*SCALE;f.va=body.getAngularVelocity();
          this.fragmentSnapshots.set(f,{x:f.x,y:f.y,vx:f.vx,vy:f.vy,va:f.va});
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
        if(game.destroyed){this.makeFragments(game);this.syncFragmentEffects();}else{this.syncExternal(game)}
        this.world.setGravity(this.v(0,game.gravityLow?4.5:17));
        this.syncDrag(game);
        if(!game.destroyed)this.stabilizeLimbs(game);
        if(game.stasisTime>0 && this.torso){this.torso.setLinearVelocity(this.v(0,0));this.torso.setAngularVelocity(0)}
        for(let i=0,n=Math.max(1,Math.ceil(dt/(1/120)));i<n;i++){
          this.world.step(dt/n,20,12);
          this.containDraggedBody(game);
        }
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