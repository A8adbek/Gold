// Optional visual/input smoke test: npm install --no-save playwright first.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const os=require('node:os');
const root=path.resolve(__dirname,'../notebook/src/main/assets');
(async()=>{
 const server=http.createServer((req,res)=>{
   const file=path.join(root,req.url==='/'?'index.html':req.url);
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
   try{res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
   browser=await chromium.launch({headless:true});
   const page=await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.clock.install();
   await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR||os.tmpdir(),'notebook-menu.png')});
   await page.locator('#start').click();
   await page.clock.runFor(4300);
   assert.ok(Number(await page.locator('#distance').textContent())>60);
   await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR||os.tmpdir(),'notebook-playing.png')});
   await page.locator('#pause').click();const d=await page.locator('#distance').textContent();
   await page.clock.runFor(2000);assert.equal(await page.locator('#distance').textContent(),d);
   await page.locator('#start').click();await page.clock.runFor(300);
   assert.ok(Number(await page.locator('#distance').textContent())>Number(d));
   await page.locator('#quality').click();assert.match(await page.locator('#quality').textContent(),/YOQIQ/);
   await page.evaluate(()=>window.pauseGame());assert.equal(await page.locator('#overlay').isVisible(),true);
   await page.reload();assert.match(await page.locator('#quality').textContent(),/YOQIQ/);
   // Browser console must stay clean; all resources are local.
   assert.deepEqual(errors,[]);
   console.log('PASS: mobile render, start, progress, pause/resume, lifecycle, quality persistence, no JS errors');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
