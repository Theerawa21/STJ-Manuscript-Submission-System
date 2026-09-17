const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners={},sent=[],timers=new Map();let tid=0;
const ctx={crypto:{randomUUID:()=> 'test-channel'},Map,Promise,Error,console,
  setTimeout:fn=>{timers.set(++tid,fn);return tid;},clearTimeout:id=>timers.delete(id),
  document:{addEventListener(){},getElementById:()=>({textContent:'',classList:{toggle(){}}})},
  window:{addEventListener:(name,fn)=>listeners[name]=fn}};
vm.runInNewContext(fs.readFileSync('api-client.js','utf8'),ctx);
const bridge={postMessage:(m,origin)=>sent.push({m,origin})};
const msg=(origin,source,data)=>listeners.message({origin,source,data});
const ready={protocol:'stj-bridge-v1',channel:'test-channel',kind:'ready'};
(async()=>{
  const p=ctx.window.stjApi('getPublicConfig',null);
  msg('https://attacker.example',bridge,ready);await new Promise(setImmediate);assert.equal(sent.length,0);
  msg('https://script.googleusercontent.com',bridge,{...ready,channel:'wrong'});await new Promise(setImmediate);assert.equal(sent.length,0);
  msg('https://n-test-0lu-script.googleusercontent.com',bridge,ready);await new Promise(setImmediate);assert.equal(sent.length,1);
  assert.equal(sent[0].origin,'https://n-test-0lu-script.googleusercontent.com');
  const reply={protocol:'stj-bridge-v1',channel:'test-channel',kind:'response',id:sent[0].m.id,result:{ok:true,data:{journal:'STJ'}}};
  msg(sent[0].origin,{},reply);assert.equal(timers.size,1);
  msg(sent[0].origin,bridge,reply);assert.equal((await p).journal,'STJ');assert.equal(timers.size,0);
  await assert.rejects(ctx.window.stjApi('setupSystem',null),/ไม่รองรับ/);
  const failed=ctx.window.stjApi('trackManuscript',{});await new Promise(setImmediate);
  msg(sent[1].origin,bridge,{...reply,id:sent[1].m.id,result:{ok:false,error:'not found'}});
  await assert.rejects(failed,/not found/);
  for(const file of ['system.html','backend/apps-script/Bridge.html']){
    const html=fs.readFileSync(''+file,'utf8').replace('<?= channel ?>','test-channel');
    for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
  }
  console.log('PASS GitHub transport: origin, channel, source, method allowlist, success/error responses and script syntax');
})();

