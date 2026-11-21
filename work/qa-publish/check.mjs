import {createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {memoryD1} from './d1.mjs';

const work = new URL('../',import.meta.url);
const workPath = name => fileURLToPath(new URL(name,work));
const db = memoryD1(new URL('yestersites-edition/drizzle/',work));
const origin = 'https://fixture.test';
// Import the same built ESM that Sites actually runs.
const scratch = mkdtempSync(join(tmpdir(),'retro-member-check-'));
const built = join(scratch,'worker.mjs');
copyFileSync(process.env.RETRO_TEST_WORKER || workPath('yestersites-edition/dist/server/index.js'),built);
const worker = (await import(pathToFileURL(built))).default;
process.on('exit',()=>rmSync(scratch,{recursive:true,force:true}));

const cookies=new Map();
async function visit(path,{owner,body,method=body===undefined?'GET':'POST',headers={},form}={}) {
  if(owner){
    if(!cookies.has(owner)){
      const value=randomBytes(32).toString('hex'),digest=createHash('sha256').update(value).digest('hex');
      db.prepare('INSERT INTO member_sessions(digest,owner,expires) VALUES(?,?,?)').bind(digest,owner,Math.floor(Date.now()/1000)+3600).run();
      cookies.set(owner,'__Host-ys_session='+value);
    }
    headers={...headers,Cookie:cookies.get(owner)};
  }
  if(body!==undefined) headers={...headers,'Content-Type':form?'application/x-www-form-urlencoded':'application/json'};
  const req=new Request(new URL(path,origin),{
    method,headers,body:body===undefined?undefined:form?new URLSearchParams(body).toString():JSON.stringify(body),
  });
  return worker.fetch(req,{DB:db});
}
async function check(path,expected,options) {
  const response=await visit(path,options);
  assert.equal(response.status,expected,path+' '+response.status+' '+(response.status===expected?'':await response.text()));
  return response;
}
function sample(source) {
  if(source==='desktop')return JSON.parse(execFileSync(workPath('desktop-qa/python'),['-c',[
    'import json,sys',
    'sys.path.insert(0,sys.argv[1])',
    'from app import make_sample',
    'print(json.dumps(make_sample()))',
  ].join(';'),workPath('desktop-app')],{encoding:'utf8',maxBuffer:1024*1024}));
  const env={window:{}};
  runInNewContext(readFileSync(workPath('retro-page-web/presets.js'),'utf8'),env);
  return structuredClone(env.window.retroPresets.sample);
}
const text=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const anchors=html=>[...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:m[1],label:text(m[2])}));
const images=html=>[...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]);
const publicPath=(url,base)=>{const u=new URL(url,new URL(base,origin));assert.equal(u.origin,origin);return u.pathname+u.search;};
const homeUrl=slug=>'/members/'+slug+'/';
const post=(body,owner='alice')=>({method:'POST',owner,body,headers:{Origin:origin}});
const send='/api/desktop/publish';

for(const source of ['web','desktop']){
  const doc=sample(source);
  doc.slug='late-night-'+source;
  doc.listed=source==='web';
  assert.equal(doc.title,'Late Night Signal');assert.equal(doc.pages.length,2);
  await check(send,401,post(doc,null));
  await check(send,403,{...post(doc),headers:{Origin:'https://not-this-site.test'}});
  const receipt=await(await check(send,200,post(doc))).json();
  assert.equal(receipt.url,homeUrl(doc.slug));
  const path=receipt.url, home=await(await check(path,200)).text();
  const downloaded=new Set();
  const files=new Map();
  for(const link of [path,...['Station Log','Links'].map(label=>{
      const anchor=anchors(home).find(a=>a.label===label);
      assert.ok(anchor,'missing home navigation: '+label);
      return publicPath(anchor.url,path);
  })]){
    const response=await check(link,200);
    const page=await response.text();
    files.set(link,page);
    assert.match(page,/<title>/i);
    for(const src of images(page)){
      if(src.startsWith('data:')){assert.match(src,/^data:image\/(gif|png|jpeg);base64,/);continue;}
      const r=await check(publicPath(src,link),200);
      assert.match(r.headers.get('Content-Type'),/^image\/(gif|png|jpeg)/);
      const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>8);downloaded.add(bytes.toString('base64'));
    }
    assert.ok(anchors(page).some(a=>a.label==='Home'),'missing link back to Home');
  }
  assert.equal(files.size,3,'published child navigation must open distinct documents');
  for(const page of doc.pages){
    assert.ok([...files.values()].some(html=>html.includes('<title>'+page.title)),'missing child: '+page.title);
  }
  for(const page of [doc,...doc.pages]){
    for(const obj of page.items.filter(o=>o.kind==='image'&&o.src)){
      assert.ok(downloaded.has(obj.src.split(',')[1]),'missing or changed original image: '+(obj.text||'background'));
    }
    for(const edition of ['classic','text','phone','modern']){
      const filename=page===doc?edition+'.html':'page-'+page.page_id+'-'+edition+'.html';
      const html=await(await check(path+filename,200)).text();
      assert.ok(anchors(html).some(a=>a.label==='Station Log'),'edition lost internal navigation: '+filename);
    }
  }
  assert.ok(receipt.revision,'initial publish missing revision');
  const rev=path.replace('/members/','/api/site/')+'revisions';
  const undo=rev.replace(/revisions$/,'rollback');
  const revised=structuredClone(doc);
  revised.title='Edited signal';
  revised.pages[0].title='Logged edit';
  const changed=await(await check(send,200,post(revised))).json();
  assert.notEqual(changed.revision,receipt.revision);
  const history=await(await check(rev,200,{owner:'alice'})).json();
  assert.ok(history.revisions.some(r=>r.id===receipt.revision));
  const protectedRestore=await visit(undo,post({revision:receipt.revision},'outsider'));
  assert.ok([403,404].includes(protectedRestore.status),'revision restoration must check ownership');
  await check(undo,200,post({revision:receipt.revision}));
  assert.match(await(await check(path,200)).text(),/<title>Late Night Signal/);
  assert.match(await(await check(path+'page-'+doc.pages[0].page_id+'-modern.html',200)).text(),/<title>Station Log/);
  await check(send,409,post({...doc,title:'Overwritten by outsider'},'outsider'));
  const invalid=structuredClone(doc);
  invalid.pages[1].items[0].w=-1;
  await check(send,400,post(invalid));
  assert.match(await(await check(path,200)).text(),/<title>Late Night Signal/);
  assert.equal((await(await check(rev,200,{owner:'alice'})).json()).current,receipt.revision);
  const listed=await(await check('/api/directory',200)).json();
  assert.equal(listed.sites.some(s=>s.slug===doc.slug),doc.listed);
  console.log(source+': published 3 pages, images and internal navigation verified. Owner and listing rules checked.');
}
const discovery=await(await check('/api/discover/newest',200)).text();
assert.ok(discovery.includes('/members/late-night-web/'));
assert.ok(!discovery.includes('/members/late-night-desktop/'));
for(const path of ['/api/discover/random','/api/discover/next?from=late-night-web']){
  const result=await check(path,302);
  const directory=await(await check('/api/directory',200)).json();
  assert.ok(directory.sites.some(r=>r.url===publicPath(result.headers.get('Location'),'/')));
}

const widgetSite=sample('web');
widgetSite.title='Counter and guestbook fixture';
widgetSite.slug='widget-check';widgetSite.listed=true;
const counter=structuredClone(widgetSite.items.find(o=>o.kind==='text'&&o.font_family!=='Lightning Display'));
Object.assign(counter,{id:'count-first',widget:'counter',text:'000000'});
const book=structuredClone(widgetSite.items.find(o=>o.kind==='image'&&o.text));
Object.assign(book,{id:'guestbook',widget:'guestbook',text:'Sign our guestbook'});
widgetSite.items.push(counter,{...counter,id:'count-second',y:counter.y+1},book);
await check(send,200,post(widgetSite));
const widgetHome=homeUrl(widgetSite.slug);
const firstVisit=await(await check(widgetHome,200)).text();
const postedNumber=t=>{
  const content=text(t.replace(/<style[\s\S]*?<\/style>/gi,'')).match(/\b0\d{5}\b/g);
  assert.ok(content?.length>=2,'each counter should render its digit string as accessible text');
  assert.equal(new Set(content).size,1,'counter widgets on one page must agree');return Number(content[0]);
};
const initial=postedNumber(firstVisit);
await check(widgetHome,200,{method:'HEAD'});
const bookPath=widgetHome+'guestbook/';
const form=await(await check(bookPath,200)).text();
assert.match(form,/<form\b/i);
const submit=await visit(bookPath,{owner:'visitor',method:'POST',body:{name:'Pat',message:'Loved the broadcast'},form:true,headers:{Origin:origin}});
assert.ok([200,201,302,303].includes(submit.status),'guestbook submit '+submit.status+' '+(submit.status>=400?await submit.text():''));
assert.match(await(await check(bookPath,200)).text(),/Loved the broadcast/);
assert.equal(postedNumber(await(await check(widgetHome,200)).text()),initial+1,'only a page visit increments the page counter');
const burst=await Promise.all(Array.from({length:6},async()=>postedNumber(await(await check(widgetHome,200)).text())));
assert.deepEqual(burst.sort((a,b)=>a-b),Array.from({length:6},(_,i)=>initial+i+2),'simultaneous page views must increment individually');
await check(widgetHome+'page-'+widgetSite.pages[0].page_id+'.html',200);
assert.equal(postedNumber(await(await check(widgetHome,200)).text()),initial+9,'a child-page visit should count even without a counter object on that page');
await check(send,200,post({...widgetSite,title:'New year'}));
assert.match(await(await check(bookPath,200)).text(),/Loved the broadcast/);
assert.equal(postedNumber(await(await check(widgetHome,200)).text()),initial+10,'views survive republishing');
console.log('Revision history, rollback, listed-only discovery, guestbook and atomic page counters passed.');
const bbsDocument=JSON.parse(readFileSync(workPath('desktop-app/assets/templates/Dial-up BBS.yst'),'utf8'));
const bbs=bbsDocument.document||bbsDocument;
bbs.slug='bbs-check';bbs.listed=false;
const asciiObject=bbs.items.find(o=>o.widget==='bbs-art') || bbs.pages.flatMap(p=>p.items).find(o=>o.widget==='bbs-art');
asciiObject.text='    /----\\\n    |BBS |';
await check('/api/desktop/publish',200,{owner:'bbs-owner',body:bbs});
for(const width of [32,40,80]){
  const screen=await(await check('/members/bbs-check/terminal.txt?columns='+width,200)).text();
  assert.match(screen,/CONNECT 2400/);assert.ok(screen.split('\r\n').every(line=>line.length<=width));
}
const artPage=bbs.pages.find(p=>p.items.some(o=>o.id===asciiObject.id));
const artPath=artPage?'page-'+artPage.page_id+'-terminal.txt':'terminal.txt';
const asciiScreen=await(await check('/members/bbs-check/'+artPath,200)).text();assert.ok(asciiScreen.includes('    /----'));
await check('/members/bbs-check/terminal.txt?columns=0',400);
console.log('Hosted authored BBS terminal output passed for all widths and preserved leading spaces.');
const av=sample('web');
av.slug='projection-test';av.listed=true;
av.bbsScreen=[{widget:'bbs-art',text:'   PRIVATE TERMINAL TEXT',href:''},{widget:'bbs-menu',text:'Log',href:'page:'+av.pages[0].page_id}];
const addPlayer=(id,widget,href)=>({id,kind:'box',widget,href,text:'Test player',x:10,y:10,w:320,h:250,autoplay:false,loop:false});
av.items.push(addPlayer('yt','video-player','https://youtu.be/M7lc1UVf-VE'),addPlayer('ia','video-player','https://archive.org/details/TripDown1905'),addPlayer('rumble','video-player','https://rumble.com/embed/v17zczn/'),addPlayer('native','audio-player','https://example.org/test.mp3'));
await check(send,200,post(av));
const avhome='/members/projection-test/';
const graphic=await(await check(avhome,200)).text();
assert.equal((graphic.match(/<iframe /g)||[]).length,3);
assert.match(graphic,/youtube-nocookie.com\/embed\/M7lc1UVf-VE/);assert.match(graphic,/archive.org\/embed\/TripDown1905/);assert.match(graphic,/rumble.com\/embed\/v17zczn/);assert.match(graphic,/<audio /);
assert.doesNotMatch(graphic,/PRIVATE TERMINAL TEXT/);
const plain=await(await check(avhome+'text.html',200)).text();
assert.doesNotMatch(plain,/<iframe |<audio |PRIVATE TERMINAL TEXT/);assert.match(plain,/https:\/\/youtu.be\/M7lc1UVf-VE/);
assert.match(await(await check(avhome+'terminal.txt',200)).text(),/   PRIVATE TERMINAL TEXT/);
assert.match(await(await check('/api/feed.xml',200)).text(),/projection-test/);
const invalidAv=structuredClone(av);invalidAv.bbsScreen[1].href='page:missing';
await check(send,400,post(invalidAv));
assert.match((await check(avhome+'?surfer=1',200)).headers.get('Content-Security-Policy'),/script-src 'sha256-/);
console.log('Separate BBS, provider and native media, text fallbacks, RSS and ring bridge passed.');
const cinema=structuredClone(av);
cinema.slug='compatibility-bulletin-check';
const cabinet=cinema.items.find(o=>o.id==='yt');
const projectorStill=readFileSync(workPath('retro-page-web/assets/instruments/film-still.gif'));
Object.assign(cabinet,{fallbackPoster:'data:image/gif;base64,'+projectorStill.toString('base64'),
  fallbackText:'A trolley approaches the station.',fallbackTranscript:'A brass lamp hangs above the tracks.',
  fallbackUrl:'https://example.org/still.html',transcriptUrl:'https://example.org/trip.txt'});
const bulletinId='ffd1bbc1d00d4ca29683bc0c8fc5e0aa';
cinema.bbsScreen.push({widget:'bbs-menu',text:'Projector notes',href:'',hotkey:'2',bulletin:{id:bulletinId,body:'The streetcar leaves at dawn.'}});
await check(send,200,post(cinema));
const cinemaHome=homeUrl(cinema.slug);
const classicStill=await(await check(cinemaHome+'classic.html',200)).text();
const stillPath=classicStill.match(/<img src="([^"]+\.GIF)" alt="A trolley/i)?.[1];
assert.ok(stillPath&&classicStill.includes('https://example.org/still.html'));
const gotStill=await check(publicPath(stillPath,cinemaHome),200);
assert.deepEqual(Buffer.from(await gotStill.arrayBuffer()),projectorStill);
const txt=await(await check(cinemaHome+'text.html',200)).text();
assert.ok(txt.includes(cabinet.fallbackTranscript)&&txt.includes('Transcript link')&&!txt.includes(stillPath));
const keyRoute=await check(cinemaHome+'bbs/?command=2',302);
const opened=await(await check(publicPath(keyRoute.headers.get('location'),cinemaHome),200)).text();
assert.ok(opened.includes('The streetcar leaves at dawn.')&&opened.includes('[0]'));
const editionBackup=await(await check('/account/sites/'+cinema.slug+'/backup',200,{owner:'alice'})).json();
assert.equal(editionBackup.items.find(o=>o.id===cabinet.id).fallbackPoster,cabinet.fallbackPoster);
assert.deepEqual(editionBackup.bbsScreen.at(-1),cinema.bbsScreen.at(-1));
console.log('Stored classic GIF, text transcript, editable backup and numbered BBS bulletin passed.');

const panels=structuredClone(av);
panels.slug='frame-fixture';panels.items=[{...addPlayer('pane','split-frame','page:'+panels.pages[0].page_id),otherHref:'https://example.org/menu',otherLabel:'Other page'}, {...addPlayer('edge','border-ridge',''),text:''}];
await check(send,200,post(panels));
const framed=await check('/members/frame-fixture/',200),paneHtml=await framed.text();
assert.match(paneHtml,/iframe sandbox=""/);assert.match(paneHtml,/target="pane-pane"/);assert.match(paneHtml,/border:6px ridge/);
assert.match(framed.headers.get('Content-Security-Policy'),/frame-src[^;]*'self'[^;]*https:\/\/example.org/);
assert.doesNotMatch(await(await check('/members/frame-fixture/classic.html',200)).text(),/<iframe /);
panels.items[0].otherHref='page:home';await check(send,400,post(panels));
const picks=await(await check('/api/trending',200)).json();assert.equal(picks.sites.length,5);
assert.deepEqual(picks,await(await check('/api/trending',200)).json());
await check('/creators/roddy/',302);
assert.match(await (await check('/members/signal/',200)).text(),/Extra Moon/i);
const stolen={...av,slug:'signal'};await check(send,409,post(stolen,'Roddy'));
console.log('Hosted frames, safe links, fixed founder shelf, reserved addresses and daily picks passed.');
// A first-time webmaster carries the same publication intent through registration.
const member='fixture-new',webdoc={...sample('web'),slug:'nightly-signal',byline:'',listed:false};
const intent={requestId:crypto.randomUUID(),document:webdoc};
const gate='/account/publish/?draft='+intent.requestId,create='/api/editor/publish';
assert.equal((await check(gate,303)).headers.get('location'),'/signin/?returnTo='+encodeURIComponent(gate));
await check(create,401,post(intent,null));await check(create,403,post(intent,member));
const credentials={email:'night-owl@example.invalid',password:randomBytes(24).toString('hex')};
const formPost=body=>({...post(body,null),form:true});
const register={...credentials,handle:'nightowl'};
await check('/signup/',403,{...formPost(register),headers:{Origin:'https://elsewhere.invalid'}});
const signup=await check('/signup/?returnTo='+encodeURIComponent(gate),303,formPost(register));
assert.equal(signup.headers.get('location'),gate);
cookies.set(member,signup.headers.get('set-cookie').split(';')[0]);
await check('/signup/',409,formPost({...register,email:'another@example.invalid'}));
await check('/signup/',409,formPost({...register,email:'second@example.invalid',handle:'roddy'}));
await check('/signout/',303,{...formPost({}),owner:member});
await check(create,401,post(intent,member));
await check('/signin/',401,formPost({...credentials,password:'incorrect password'}));
const signin=await check('/signin/',303,formPost(credentials));
cookies.set(member,signin.headers.get('set-cookie').split(';')[0]);
await check(create,403,{...post(intent,member),headers:{Origin:'https://unrelated.invalid'}});
const availability=async(owner)=> (await(await check('/api/address?slug=nightly-signal',200,{owner})).json()).state;
assert.equal(await availability(),'available');
const receipt=await(await check(create,200,post(intent,member))).json();
assert.deepEqual(await(await check(create,200,post(intent,member))).json(),receipt);
assert.equal(await availability(member),'owned');assert.equal(await availability('second-new'),'claimed');
assert.equal((await(await check('/api/site/nightly-signal/revisions',200,{owner:member})).json()).revisions.length,1);
assert.doesNotMatch(await(await check('/api/directory',200)).text(),/nightly-signal/);
assert.match(await(await check('/account/',200,{owner:member})).text(),/nightowl/);
console.log('Registration, sign-in return, unique handles, address checks, unlisted publishing and idempotent retries passed.');
const mixed=sample('web');mixed.slug='handmade-flash';mixed.listed=false;
mixed.pageStyles='.link { color: #aabeef; }';
const baseBox=addPlayer('html','html-block','');
const htmlBlock={...baseBox,text:'Bulletin',markup:'<div class="notice"><b>Station news</b></div>',styles:'.notice { color: navy; border: 2px solid gold; }'};
const swf=readFileSync(workPath('github-pages/flash/comet.swf')).toString('base64');
mixed.items.push(htmlBlock,{...baseBox,id:'flash',widget:'flash-movie',text:'Comet flyby',swf});
await check(send,200,post(mixed));
const modern=await check('/members/handmade-flash/modern.html',200),raw=await modern.text();
assert.match(raw,/sandbox="allow-scripts"/);assert.ok(raw.includes('https://yestersites.com/flash/#'+swf));
assert.match(raw,/sandbox=""[^>]+srcdoc=/);assert.match(raw,/Station news/);assert.match(raw,/color:#aabeef!important/);
assert.ok(modern.headers.get('Content-Security-Policy').includes('https://yestersites.com/flash/'));
const classic=await(await check('/members/handmade-flash/classic.html',200)).text();
assert.match(classic,/<b>Station news<\/b>/);assert.match(classic,/\[Flash movie\] Comet flyby/);assert.doesNotMatch(classic,/srcdoc=|ruffle.js/);
for(const changes of [{markup:'<form>Registration</form>'},{styles:'.notice { position: fixed; }'}]){
  await check(send,400,post({...mixed,items:[{...htmlBlock,...changes}]}));
}
await check(send,400,post({...mixed,pageStyles:'.outside { color: red; }'}));
await check(send,400,post({...mixed,items:[{...mixed.items.at(-1),swf:'This is not a movie'}]}));
console.log('Published SWF bytes, sandboxed HTML, scoped page CSS, classic fallback and server validation passed.');

const painted=sample('web');painted.slug='colored-beacon';
const firstChild=painted.pages[0].page_id,rawDownload=Buffer.from('Tower log\r\n');
painted.bbsScreen=[
  {widget:'bbs-paint',text:'Beacon',href:'',paint:{mode:'ansi',width:32,height:1,cells:'┌─┐'.padEnd(32),colors:'c0'.repeat(3)+'70'.repeat(29)}},
  {widget:'bbs-menu',text:'Station Log',hotkey:'L',ink:'e0',href:'page:'+firstChild},
  {widget:'bbs-wall',text:'Shack wall',href:''},
  {widget:'bbs-files',text:'Tower log',href:'',hotkey:'F',attachment:{name:'TOWER.TXT',data:rawDownload.toString('base64')}},
  {widget:'bbs-door',text:'Archive door',href:'https://archive.org/',hotkey:'D'},
];
await check(send,200,post(painted));
const room='/members/colored-beacon/',bbsAddr=room+'bbs/?page=home&columns=40';
const board=await(await check(bbsAddr,200)).text();
assert.match(board,/color:#ff5555;background-color:#000000">┌─┐/);
assert.match(board,/\[L\] Station Log|\[L\]  Station Log/);assert.match(board,/Post line/);
assert.equal((await check(bbsAddr+'&command=L',302)).headers.get('location'),room+'bbs/?page='+firstChild+'&columns=40');
assert.equal((await check(bbsAddr+'&command=D',302)).headers.get('location'),'https://archive.org/');
const download=(await check(bbsAddr+'&command=F',302)).headers.get('location');
const attachment=await check(download,200);assert.match(attachment.headers.get('content-disposition'),/TOWER.TXT/);assert.deepEqual(Buffer.from(await attachment.arrayBuffer()),rawDownload);
await check(bbsAddr,303,{method:'POST',form:true,body:{name:'Moth',line:'Beacon seen.'},headers:{Origin:origin}});
assert.match(await(await check(bbsAddr,200)).text(),/Moth: Beacon seen\./);
await check(room+'bbs/?page='+firstChild,404,{method:'POST',form:true,body:{name:'Moth',line:'Closed'},headers:{Origin:origin}});
const ansiBytes=Buffer.from(await(await check(room+'terminal.ans',200)).arrayBuffer());
assert.ok(ansiBytes.includes(Buffer.from([0xda,0xc4,0xbf])));assert.ok(ansiBytes.includes(Buffer.from('\x1b[91;40m')));
const petBytes=Buffer.from(await(await check(room+'terminal.pet',200)).arrayBuffer());
assert.ok(petBytes.includes(Buffer.from([0xb0,0x60,0xae])));assert.ok(petBytes.includes(150));
assert.match(await(await check(room+'terminal.txt',200)).text(),/\+-\+/);
const badKeys=structuredClone(painted);badKeys.bbsScreen[3].hotkey='L';await check(send,400,post(badKeys));
console.log('Painted ANSI, PETSCII and ASCII bytes, custom command keys, door, file attachment and durable one-liners passed.');
db.close();
