/* Verify that the actual shipped HTML loads Planck, supports knife collisions, and renders. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
(async()=>{
 const locations=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean);
 const executable=locations.find(x=>fs.existsSync(x));
 assert.ok(executable,'Chrome or Chromium binary required on Actions runner');
 const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(String(e)));
  await page.goto('file://'+path.resolve(__dirname,'../index.html'),{waitUntil:'load'});
  await page.waitForFunction('window.ARCMAP_RAGE_DEBUG && window.ArcV7Physics && window.ArcV7Physics.enabled',{timeout:15000});
  await page.waitForTimeout(250);
  const stats=await page.evaluate(()=>{
    const d=window.ARCMAP_RAGE_DEBUG;
    const idx=d.weapons.findIndex(w=>w.name==='THROWING KNIVES');
    d.setWeapon(idx);
    const b=d.game.body;
    const projectile={type:'knife',prevX:b.x-230,prevY:b.y,x:b.x+180,y:b.y,vx:1250,vy:0,r:8,damage:9.5,impulse:540};
    const hit=d.physics.rayHit(projectile);
    const collided=d.hitProjectile(projectile);
    const embedded=d.game.knives.length;
    const impactPart=hit?.part;
    d.destroyArcMap(b.x,b.y);
    d.step(.016);
    return {weapons:d.weapons.length,physics:d.physics.enabled,impactPart,collided,embedded,fragments:d.game.fragments.length,rigidFragments:d.physics.fragBodies.length};
  });
  console.log('Browser integration:',JSON.stringify(stats));
  assert.equal(stats.weapons,38);
  assert.equal(stats.physics,true);
  assert.ok(stats.impactPart && stats.collided && stats.embedded>=1,'Actual knife must stick to the hit physical part');
  assert.equal(stats.fragments,12);
  assert.equal(stats.rigidFragments,12);
  await page.waitForTimeout(250);
  assert.deepEqual(exceptions,[],'Browser must not throw JavaScript exceptions');
  console.log('PASS: Browser loaded Planck, 38 weapons, knife embedding and 12 physical fragments.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});