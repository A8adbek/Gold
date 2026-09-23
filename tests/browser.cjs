// Optional browser test: npm install --no-save playwright@1.58.2
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../notebook/src/main/assets');
(async()=>{
 const server=http.createServer((req,res)=>{
   const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url));
   if(!file.startsWith(root+path.sep)){res.statusCode=403;res.end();return;}
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
   try{res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
   browser=await chromium.launch({headless:true});
   const page=await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
   await page.addInitScript(()=>Math.random=()=>.9);
   await page.goto('http://127.0.0.1:'+server.address().port);await page.clock.install();
   const screenshot=name=>page.screenshot({path:path.join(process.env.SCREENSHOT_DIR||os.tmpdir(),name+'.png')});
   await screenshot('notebook-menu');
   await page.locator('#settings').evaluate(e=>e.open=true);
   await page.locator('#invert').check();await page.locator('#quality').click();
   await page.locator('#sensitivity').evaluate(e=>{e.value='75';e.dispatchEvent(new Event('input'));});
   await page.locator('#start').click();await page.clock.runFor(1000);
   assert.equal(await page.locator('#distance').textContent(),'0');assert.ok(await page.locator('#launch-panel').isVisible());
   await screenshot('notebook-launch');
   const cdp=await page.context().newCDPSession(page);
   const touch=(type,x=0,y=0)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
   const box=await page.locator('#pull-zone').boundingBox(),cx=box.x+box.width/2,cy=box.y+15;
   await touch('touchStart',cx,cy);await touch('touchMove',cx,cy+65);await touch('touchEnd');
   await page.clock.runFor(1500);assert.ok(Number(await page.locator('#distance').textContent())>5);
   assert.equal(await page.locator('#launch-panel').isVisible(),false);
   await screenshot('notebook-playing');
   await touch('touchStart',200,600);await touch('touchMove',220,605);await page.clock.runFor(350);
   assert.ok(await page.locator('#stick').isVisible());await touch('touchCancel');assert.equal(await page.locator('#stick').isVisible(),false);
   await page.locator('#pause').click();const d=await page.locator('#distance').textContent(),t=await page.locator('#time').textContent();
   await page.clock.runFor(2000);assert.equal(await page.locator('#distance').textContent(),d);assert.equal(await page.locator('#time').textContent(),t);
   await page.locator('#start').click();await page.clock.runFor(400);assert.ok(Number(await page.locator('#distance').textContent())>Number(d));
   await page.evaluate(()=>window.pauseGame());assert.ok(await page.locator('#overlay').isVisible());
   await page.locator('#restart').click();assert.ok(await page.locator('#launch-panel').isVisible());
   await page.keyboard.press('Enter');await page.clock.runFor(35000);assert.ok(await page.locator('#overlay').isVisible());
   assert.ok(/qo‘nish|parvoz/.test(await page.locator('#title').textContent()));await screenshot('notebook-result');
   await page.reload();await page.locator('#settings').evaluate(e=>e.open=true);
   assert.ok(await page.locator('#invert').isChecked());assert.equal(await page.locator('#sensitivity').inputValue(),'75');
   assert.match(await page.locator('#quality').textContent(),/YOQIQ/);
   await page.setViewportSize({width:360,height:640});await screenshot('notebook-small-screen');
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   console.log('PASS: touch launch, bank input/cancel, pause/resume, landing/restart, settings persistence, offline resources, mobile render');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
