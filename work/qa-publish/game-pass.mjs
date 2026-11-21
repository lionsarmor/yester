import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import worker from '../yestersites-edition/dist/server/index.js';
import {memoryD1} from './d1.mjs';

const db=memoryD1(new URL('../yestersites-edition/drizzle/',import.meta.url));
const doc=JSON.parse(readFileSync(new URL('../retro-page-web/assets/starters/pocket-bog.json',import.meta.url),'utf8'));
const origin='https://fixture.test',session=randomBytes(32).toString('hex');
db.prepare('INSERT INTO member_sessions(digest,owner,expires) VALUES(?,?,?)').bind(createHash('sha256').update(session).digest('hex'),'tester',Math.ceil(Date.now()/1000)+120).run();
db.prepare('INSERT INTO webmasters(owner,handle,joined) VALUES(?,?,?)').bind('tester','marshkeeper','2026-11-20').run();
function request(path,body,member=false){
  const headers={Origin:origin};if(member)headers.Cookie='__Host-ys_session='+session;
  if(body)headers['Content-Type']=typeof body==='string'?'application/x-www-form-urlencoded':'application/json';
  return worker.fetch(new Request(origin+path,{headers,method:body?'POST':'GET',body:typeof body==='string'?body:JSON.stringify(body)}),{DB:db});
}
async function checked(path,body,member=false,expected=200){
  const res=await request(path,body,member);assert.equal(res.status,expected,res.status===expected?'':(await res.text()).slice(0,250));return res;
}
const input={requestId:crypto.randomUUID(),source:doc,document:doc};
const firstRelease=await(await checked('/api/editor/publish',input,true)).json();
const gamePage=doc.pages.find(page=>page.items.some(item=>item.widget==='game-cartridge'));
const inPlayableRing=async()=> (await(await checked('/api/directory?cap=playable')).json()).sites.some(s=>s.slug===doc.slug);
const capabilities=async()=>((await(await checked('/api/directory')).json()).sites.find(site=>site.slug===doc.slug)).capabilities;
assert.deepEqual(await capabilities(),['playable','touch','gamepad']);
assert.ok(await inPlayableRing());
for(const sample of ['lantern-run.nes','pond-post.gb']){
  const upload=structuredClone(doc),item=upload.pages.find(page=>page.page_id===gamePage.page_id).items.find(item=>item.widget==='game-cartridge');
  item.romData=readFileSync(new URL('../github-pages/arcade/'+sample,import.meta.url)).toString('base64');item.romUrl='';
  await checked('/api/editor/publish',{requestId:crypto.randomUUID(),document:upload,source:upload},true);
  const backup=await(await checked('/account/sites/'+doc.slug+'/project',undefined,true)).json();
  assert.deepEqual(backup,upload);
  const html=await(await checked('/members/'+doc.slug+'/page-'+gamePage.page_id+'-modern.html')).text();
  assert.ok(html.includes('#data='+item.romData));assert.ok(html.includes('installCartridgeStorage'));
  item.romData='bm90IGEgY2FydHJpZGdl';
  await checked('/api/editor/publish',{requestId:crypto.randomUUID(),document:upload,source:upload},true,400);
}
const nongame=structuredClone(doc);
for(const p of [nongame,...nongame.pages])p.items=p.items.filter(item=>item.widget!=='game-cartridge');
await checked('/api/editor/publish',{requestId:crypto.randomUUID(),document:nongame,source:nongame},true);
assert.deepEqual(await capabilities(),[]);
assert.ok(!await inPlayableRing());
const unlisted={...doc,listed:false};
await checked('/api/editor/publish',{requestId:crypto.randomUUID(),document:unlisted,source:unlisted},true);
assert.ok(!await inPlayableRing());
await checked('/api/site/'+doc.slug+'/rollback',{revision:firstRelease.revision},true);
assert.deepEqual(await capabilities(),['playable','touch','gamepad']);
assert.ok(await inPlayableRing());
const directory=(await(await checked('/api/directory')).json()).sites.find(s=>s.slug===doc.slug);
assert.deepEqual(directory.categories,doc.categories);assert.deepEqual(directory.tags,doc.tags);
for(const [page,kind] of [[doc.pages[0],'flash'],[doc.pages[2],'arcade']]){
  const root='/members/'+doc.slug+'/page-'+page.page_id;
  const resp=await checked(root+'-modern.html');assert.ok(resp.headers.get('content-security-policy').includes('https://yestersites.com/'+kind+'/'));
  assert.ok((await resp.text()).includes('sandbox="allow-scripts"'));assert.ok(!(await(await checked(root+'-text.html')).text()).includes('<iframe'));
}
const fields=new URLSearchParams({name:'Test Keeper',bio:'Cares for <bog> moths.',stamp:'mushroom',ink:'lagoon',featured:doc.slug,visible:'on'});
await checked('/account/profile/',fields.toString(),true,303);
let html=await(await checked(directory.creatorUrl)).text();assert.ok(html.includes('Test Keeper')&&html.includes('&lt;bog&gt;')&&html.includes('Featured homepage'));
fields.set('featured','somebody-elses');await checked('/account/profile/',fields.toString(),true,400);
await checked('/account/profile/',undefined,false,303);
const invalid={...doc,categories:['invalid']};await checked('/api/editor/publish',{...input,requestId:crypto.randomUUID(),document:invalid},true,400);
console.log('Pocket Bog four-page publish, Grub metadata, Ruffle and cartridge editions, privacy and creator profile updates passed.');
