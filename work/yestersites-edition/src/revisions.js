const releaseLimit = 16 * 1024 * 1024;
const pageKey = /^[0-9a-f]{32}$/;
async function publishRelease(input, origin, owner, db, rev=crypto.randomUUID(),source=null) {
  const doc=input?.document || input;
  if(!doc || !Array.isArray(doc.pages ?? []) || (doc.pages||[]).length>23) throw new Issue("Choose a project with up to 24 pages.");
  const ids=new Set(["home"]);
  for(const p of doc.pages||[]){
    if(!p || !pageKey.test(p.page_id) || ids.has(p.page_id))throw new Issue("Duplicate or invalid page ID.");
    ids.add(p.page_id);
  }
  const created=new Date().toISOString(), media=new Map(), pages=[], targets=new Set();
  let summary;
  const allScreenIds=new Set(ids);
  for(const [i,p] of [doc,...doc.pages||[]].entries()) {
    const id=i?p.page_id:"home";
    const info=prepareLayout({...p,slug:doc.slug,byline:doc.byline,listed:doc.listed},origin,ids);
    if(!i)summary=info;
    if(info.blocks.items.reduce((n,o)=>n+(o.widget==='flash-movie'&&o.swf!=='demo'?o.swf.length:0),0)>1048576)throw new Issue('A page supports 768 KiB of imported Flash movies.');
    const players=info.blocks.items.filter(RetroMedia.isPlayer);
    if(players.length>4)throw new Issue("A page supports up to four players.");
    for(const player of players){
      try{RetroMedia.source(player.href,player.widget);}catch(error){throw new Issue(error.message);}
    }
    if(players.filter(o=>o.autoplay).length+Number(!!p.soundtrack)>1)throw new Issue("Choose one automatic soundtrack or player per page.");
    if(p.pageStyles!==undefined){
      try{RetroCraft.pageCSS(p.pageStyles);info.blocks.pageStyles=p.pageStyles;}catch(error){throw new Issue(error.message);}
    }
    if (p.soundtrack) {
      if (typeof p.soundtrack !== 'string' || !p.soundtrack.startsWith('https://')) throw new Issue("Use a direct HTTPS audio or stream address.");
      info.blocks.soundtrack=validLink(p.soundtrack,origin);
    }
    if (p.bbsScreen !== undefined) {
      if (!Array.isArray(p.bbsScreen) || p.bbsScreen.length > 64) throw new Issue("A BBS screen supports up to 64 blocks.");
      try{
        info.blocks.bbsScreen=p.bbsScreen.map(b=>RetroBbs.normalize(b,href=>{
          if(!href)return true;
          if(href.startsWith('page:')){if(!ids.has(href.slice(5)))throw Error('A BBS menu points to a missing page.');return true;}
          validLink(href,origin);return true;
        }));
        RetroBbs.checkKeys(info.blocks.bbsScreen);
        for(const block of info.blocks.bbsScreen)if(block.bulletin){
          if(allScreenIds.has(block.bulletin.id))throw Error('Each BBS bulletin needs a unique screen ID.');
          allScreenIds.add(block.bulletin.id);
        }
      }catch(error){throw new Issue(error.message);}
    }
    for(const link of info.links)targets.add(link);
    const page={...info.blocks,title:info.title,byline:info.byline,profile:info.profile};
    for(const o of page.items){
      o.text ??= ""; o.href ??= "";
      if(o.fallbackPoster){
        if(!media.has(o.fallbackPoster))media.set(o.fallbackPoster,media.size+1);
        o.posterMedia=media.get(o.fallbackPoster);delete o.fallbackPoster;
      }
      if(o.src){
        if(!media.has(o.src))media.set(o.src,media.size+1);
        o.media=media.get(o.src);o.src=true;
        if(o.classic_src){if(!media.has(o.classic_src))media.set(o.classic_src,media.size+1);o.classic=media.get(o.classic_src);delete o.classic_src;}
      }
    }
    const serialized=JSON.stringify(page);
    if(new TextEncoder().encode(serialized).length>1900000)throw new Issue('This page exceeds its storage limit. Move a cartridge, movie or attachment to another page.');
    pages.push([id,serialized]);
  }
  try{RetroMedia.checkFrames(pages.map(([key,json])=>[key,JSON.parse(json)]));}catch(error){throw new Issue(error.message);}
  const description=requiredText(doc.grubDescription ?? '', 'Grub description', 180, true);
  const metadata={title:summary.title,profile:summary.profile,theme:summary.theme,byline:summary.byline,listed:Number(summary.listed),links:[...targets],snippet:description || summary.snippet,keywords:summary.keywords};
  const updatePage=doc.updatePage ?? source?.updatePage ?? 'home';
  if(updatePage!=='home'){
    if(ids.has(updatePage))metadata.updatePath='page-'+updatePage+'.html';
    else if(typeof updatePage==='string' && updatePage.startsWith('bbs:') && allScreenIds.has(updatePage.slice(4)))metadata.updatePath='bbs/?page='+updatePage.slice(4);
    else throw new Issue('Choose an existing page for the Library update.');
  }
  const slug=summary.slug, ptr=JSON.stringify({release:rev,counter:[doc,...doc.pages||[]].some(p=>p.items.some(i=>i.widget==="counter"))});
  let topics;
  if(doc.categories!==undefined || doc.tags!==undefined){
    try{topics=RetroTopics.read(doc.categories||[],doc.tags||[],true);}catch(error){throw new Issue(error.message);}
  }else{
    const previous=await db.prepare('SELECT keywords_json FROM member_sites WHERE slug=? AND owner_id=?').bind(slug,owner).first();
    topics=RetroTopics.unpack(JSON.parse(previous?.keywords_json||'[]'));
  }
  metadata.keywords=[...metadata.keywords.filter(word=>!word.startsWith('category:')&&!word.startsWith('tag:')),...topics.categories.map(k=>'category:'+k),...topics.tags.map(t=>'tag:'+t)];
  metadata.keywords.push(doc.items.concat(...(doc.pages||[]).map(p=>p.items)).some(o=>o.widget==='game-cartridge')?'cap:cartridge':'cap:none');
  metadata.counter=JSON.parse(ptr).counter;
  const guard=" WHERE EXISTS(SELECT 1 FROM member_sites WHERE slug=? AND owner_id=? AND blocks_json=?)";
  const add=(table,cols,values)=>db.prepare("INSERT INTO "+table+"("+cols+") SELECT "+values.map(()=>"?").join(",")+guard).bind(...values,slug,owner,ptr);
  // Preserve an existing desktop homepage before its first revisioned publish.
  const old=await db.prepare("SELECT * FROM member_sites WHERE slug=? AND owner_id=? AND json_type(blocks_json)='object' AND json_extract(blocks_json,'$.release') IS NULL AND json_extract(blocks_json,'$.stock') IS NULL").bind(slug,owner).first();
  const legacyWrites=[];
  if(originalEdition(slug)){
    const baseline=originalEdition(slug).version;
    legacyWrites.push(db.prepare("INSERT OR IGNORE INTO site_revisions(id,slug,created,metadata) SELECT ?,slug,updated_at,json_object('title',title,'profile',profile,'theme',theme,'byline',byline,'listed',listed,'links',json(links_json),'keywords',json(keywords_json),'snippet',snippet,'original',json('true')) FROM member_sites WHERE owner_id=? AND slug=? AND json_extract(blocks_json,'$.stock')=1").bind(baseline,owner,slug));
  }
  if(old){
    const oldRev=crypto.randomUUID(),page={...JSON.parse(old.blocks_json),title:old.title,byline:old.byline,profile:old.profile};
    const metadata={title:old.title,byline:old.byline,profile:old.profile,theme:old.theme,listed:old.listed,links:JSON.parse(old.links_json),keywords:JSON.parse(old.keywords_json),snippet:old.snippet};
    const insert=(sql,...params)=>db.prepare(sql+" WHERE EXISTS(SELECT 1 FROM member_sites WHERE slug=? AND owner_id=? AND blocks_json=?)").bind(...params,slug,owner,old.blocks_json);
    legacyWrites.push(insert("INSERT INTO site_revisions(id,slug,created,metadata) SELECT ?,?,?,?",oldRev,slug,old.updated_at,JSON.stringify(metadata)));
    for(const [index,o] of page.items.entries()){
      o.text??="";o.href??="";
      if(o.src){o.media=index+1;legacyWrites.push(insert("INSERT INTO revision_media(rev,num,src) SELECT ?,?,?",oldRev,o.media,o.src));o.src=true;}
    }
    legacyWrites.push(insert("INSERT INTO revision_pages(rev,page,body) SELECT ?,?,?",oldRev,"home",JSON.stringify(page)));
  }
  const writes=[...legacyWrites,db.prepare(saveSQL).bind(slug,owner,await accountShelf(db,owner),metadata.title,metadata.profile,metadata.theme,metadata.byline,metadata.listed,ptr,JSON.stringify(metadata.links),metadata.snippet,JSON.stringify(metadata.keywords),created),
    add("site_revisions","id,slug,created,metadata",[rev,slug,created,JSON.stringify(metadata)])];
  for(const [id,body] of pages)writes.push(add("revision_pages","rev,page,body",[rev,id,body]));
  for(const [src,num] of media)writes.push(add("revision_media","rev,num,src",[rev,num,src]));
  if(source){
    if(source.slug!==slug || !Array.isArray(source.items) || source.title!==doc.title)throw new Issue("The editable project must match the release.");
    const raw=JSON.stringify(source);
    if(raw.length>releaseLimit)throw new Issue("Project exceeds the backup limit.");
    let part=0;
    for(let start=0;start<raw.length;){
      let end=Math.min(start+90000,raw.length);
      if(end<raw.length && /[\uD800-\uDBFF]/.test(raw[end-1]))end--;
      writes.push(add("revision_media","rev,num,src",[rev,--part,raw.slice(start,end)]));
      start=end;
    }
  }
  const result=await db.batch(writes);
  if(!result[legacyWrites.length].meta.changes)throw new Issue("That site address already belongs to another creator or editor.",409);
  return json({url:publicMemberUrl(slug),canonicalUrl:assignedUrl(slug),slug,revision:rev});
}
async function ownedSite(db,slug,owner) {
  if(!owner)throw new Issue("Sign in to manage revisions.",401);
  const row=await db.prepare("SELECT blocks_json FROM member_sites WHERE slug=? AND owner_id=?").bind(slug,owner).first();
  if(!row)throw new Issue("Site not found.",404);
  return JSON.parse(row.blocks_json).release;
}
function checkOrigin(request,u){
  const origin=request.headers.get("Origin");
  if(origin && origin!==u.origin)throw new Issue("Submit from the YesterSites publishing service.",403);
}
async function revisionActions(request,u,db,owner,slug,action) {
  const current=await ownedSite(db,slug,owner);
  if(action==="revisions" && request.method==="GET"){
    const {results}=await db.prepare("SELECT id,created FROM site_revisions WHERE slug=? ORDER BY created DESC,rowid DESC LIMIT 100").bind(slug).all();
    return json({current,revisions:results});
  }
  if(action!=="rollback" || request.method!=="POST")throw new Issue("Method not allowed.",405);
  checkOrigin(request,u);
  const {revision}=await readJSON(request);
  if(typeof revision!=="string")throw new Issue("Select a revision.");
  const prev=await db.prepare("SELECT metadata FROM site_revisions WHERE slug=? AND id=?").bind(slug,revision).first();
  if(!prev)throw new Issue("Revision not found.",404);
  const m=JSON.parse(prev.metadata);
  const result=await db.prepare("UPDATE member_sites SET title=?,profile=?,theme=?,byline=?,listed=?,links_json=?,snippet=?,keywords_json=?,blocks_json=?,updated_at=? WHERE slug=? AND owner_id=? AND json_extract(blocks_json,'$.release')=?").bind(m.title,m.profile,m.theme,m.byline,m.listed,JSON.stringify(m.links),m.snippet,JSON.stringify(m.keywords),JSON.stringify({release:revision,counter:Boolean(m.counter)}),new Date().toISOString(),slug,owner,current||"").run();
  if(!result.meta.changes)throw new Issue("The site changed. Refresh the revision list and try again.",409);
  return json({revision,url:publicMemberUrl(slug),canonicalUrl:assignedUrl(slug)});
}
async function discover(db,mode,from) {
  if(mode==="newest"){
    const {results}=await db.prepare("SELECT slug,title,byline FROM member_sites WHERE listed=1 ORDER BY COALESCE((SELECT MIN(created) FROM site_revisions r WHERE r.slug=member_sites.slug),updated_at) DESC,slug LIMIT 50").all();
    return html(document("Newest sites on Grub","<h1>Newest sites on Grub</h1>"+(results.length?"<ol>"+results.map(s=>'<li><a href="'+publicMemberUrl(s.slug)+'">'+e(s.title)+'</a> '+e(s.byline)+'</li>').join("")+"</ol>":"<p>No listed sites yet.</p>")+'<p><a href="/members/">All listed sites</a></p>'));
  }
  let row;
  if(mode==="random")row=await db.prepare("SELECT slug FROM member_sites WHERE listed=1 ORDER BY random() LIMIT 1").first();
  else if(mode==="previous")row=await db.prepare("SELECT slug FROM member_sites WHERE listed=1 ORDER BY CASE WHEN slug<? THEN 0 ELSE 1 END,slug DESC LIMIT 1").bind(from||"").first();
  else row=await db.prepare("SELECT slug FROM member_sites WHERE listed=1 ORDER BY CASE WHEN slug>? THEN 0 ELSE 1 END,slug LIMIT 1").bind(from||"").first();
  return new Response(null,{status:302,headers:{...defaultHeaders,Location:row?publicMemberUrl(row.slug):"/members/"}});
}
function communityResponse(markup,u){
  const surfing=u.searchParams.get('surfer')==='1';
  if(surfing)markup=markup.replace('</body>','<script>'+surferBridge+'</script></body>');
  const response=html(markup);
  let csp=publicHtmlHeaders['Content-Security-Policy'].replace("form-action 'none'","form-action 'self'");
  if(surfing)csp+="; script-src 'sha256-"+surferBridgeHash+"'";
  response.headers.set('Content-Security-Policy',csp);
  return response;
}
async function guestbook(request,u,db,slug,rev){
  const enabled=await db.prepare("SELECT 1 AS ok FROM revision_pages rp,json_each(rp.body,'$.items') obj WHERE rev=? AND json_extract(obj.value,'$.widget')='guestbook' LIMIT 1").bind(rev).first();
  if(!enabled)throw new Issue("This guestbook is closed.",404);
  if(request.method==="POST"){
    checkOrigin(request,u);
    if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))throw new Issue("Submit the guestbook form.",415);
    const data=new URLSearchParams(await readLimited(request,8192)),name=requiredText(data.get("name"),"Name",48),message=requiredText(data.get("message"),"Message",500);
    await db.prepare("INSERT INTO guest_entries(slug,name,message,created) VALUES(?,?,?,?)").bind(slug,name,message,new Date().toISOString()).run();
    return new Response(null,{status:303,headers:{...defaultHeaders,Location:memberUrl(slug)+"guestbook/"+(u.searchParams.get("surfer")==="1"?"?surfer=1":"")}});
  }
  const {results}=await db.prepare("SELECT name,message FROM guest_entries WHERE slug=? ORDER BY id DESC LIMIT 50").bind(slug).all();
  const body='<h1>Guestbook</h1><form method="post"><p><label>Name <input name="name" maxlength="48" required></label></p><p><label>Message <textarea name="message" maxlength="500" required></textarea></label></p><button>Sign guestbook</button></form>'+results.map(x=>'<p><b>'+e(x.name)+'</b><br>'+e(x.message)+'</p>').join("")+'<p><a href="'+memberUrl(slug)+'">Home</a></p>';
  return communityResponse(document("Guestbook",body),u);
}
function mediaExtension(mime){
  return {'image/gif':'GIF','image/jpeg':'JPG','image/png':'PNG'}[mime];
}
async function memberRelease(request,u,db,slug,path) {
  const row=await db.prepare("SELECT listed,json_extract(blocks_json,'$.stock') AS stock,json_extract(blocks_json,'$.counter') AS counter,json_extract(blocks_json,'$.release') AS rev FROM member_sites WHERE slug=?").bind(slug).first();
  if(row?.stock && ["GET","HEAD"].includes(request.method))return serveOriginal(request,u,slug,path);
  if(!row?.rev)return null;
  if(originalEdition(slug)){
    const entry=await db.prepare('SELECT metadata FROM site_revisions WHERE slug=? AND id=?').bind(slug,row.rev).first();
    const meta=entry && JSON.parse(entry.metadata);
    if(meta?.original && ["GET","HEAD"].includes(request.method))return serveOriginal(request,u,slug,path,meta.changes||{});
  }
  if(path==="guestbook/")return guestbook(request,u,db,slug,row.rev);
  if(!["GET","HEAD"].includes(request.method) && !(path==="bbs/" && request.method==="POST"))throw new Issue("Method not allowed.",405);
  const bbsFile=path.match(/^bbs-files\/(home|[0-9a-f]{32})\/(\d{1,2})\/([a-z\d][a-z\d._-]{0,63})$/i);
  if(bbsFile){
    const rowFile=await db.prepare('SELECT body FROM revision_pages WHERE rev=? AND page=?').bind(row.rev,bbsFile[1]).first();
    const block=rowFile && JSON.parse(rowFile.body).bbsScreen?.[Number(bbsFile[2])],file=block?.attachment;
    if(block?.widget!=='bbs-files'||file?.name!==bbsFile[3])throw new Issue('File not found.',404);
    return new Response(request.method==='HEAD'?null:RetroBbs.bytesOf(file),{headers:{...defaultHeaders,'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+file.name+'"'}});
  }
  const mediaPath=path.match(/^media\/([0-9a-f-]{36})\/(\d+)(?:\.(GIF|JPG|PNG))?$/i);
  if(mediaPath) {
    const v=await db.prepare("SELECT src FROM revision_media m JOIN site_revisions r ON r.id=m.rev WHERE r.slug=? AND m.rev=? AND m.num=?").bind(slug,mediaPath[1],Number(mediaPath[2])).first();
    if(!v)throw new Issue("Image not found.",404);
    const {bytes,mime}=desktopImage(v.src);
    if(mediaPath[3] && mediaPath[3].toUpperCase()!==mediaExtension(mime))throw new Issue("Image type does not match its filename.",404);
    return new Response(request.method==='HEAD'?null:bytes,{headers:{...defaultHeaders,"Content-Type":mime}});
  }
  const terminalPath=path.match(/^(?:page-([0-9a-f]{32})-)?terminal\.(txt|ans|pet)$/);
  if(terminalPath || path==="bbs/"){
    const ext=terminalPath?.[2];
    const columns=ext==='pet'?40:Number(u.searchParams.get("columns")||(ext==='ans'?80:32));
    if(![32,40,80].includes(columns))throw new Issue("Choose 32, 40 or 80 columns.");
    const id=terminalPath?terminalPath[1]||"home":u.searchParams.get("page")||"home";
    const {results}=await db.prepare("SELECT page,CASE WHEN page=? THEN body ELSE json_object('title',json_extract(body,'$.title')) END AS body FROM revision_pages WHERE rev=?").bind(id,row.rev).all();
    const pages=new Map(results.map(p=>[p.page,JSON.parse(p.body)]));
    if(!pages.has(id)){
      const parent=await db.prepare("SELECT p.page,json_extract(p.body,'$.title') AS title,b.value AS block FROM revision_pages AS p,json_each(p.body,'$.bbsScreen') AS b WHERE p.rev=? AND json_extract(b.value,'$.bulletin.id')=? LIMIT 1").bind(row.rev,id).first();
      if(!parent)throw new Issue('Terminal page not found.',404);
      const virtual=RetroBbs.bulletinPages([[parent.page,{title:parent.title,bbsScreen:[JSON.parse(parent.block)]}]]);
      pages.set(id,virtual[0][1]);
    }else{
      const parent=pages.get(id);
      for(const [key,bulletin] of RetroBbs.bulletinPages([[id,parent]]))pages.set(key,bulletin);
    }
    const page=pages.get(id),openWall=page.bbsScreen?.some(b=>b.widget==='bbs-wall');
    const wallKey='bbs:'+slug+':'+id;
    const surfing=u.searchParams.get('surfer')==='1';
    const address=(key,width=columns)=>memberUrl(slug)+'bbs/?page='+key+'&columns='+width+(surfing?'&surfer=1':'');
    if(request.method==='POST'){
      if(!openWall)throw new Issue('This one-liner wall is closed.',404);
      checkOrigin(request,u);
      if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new Issue('Use the one-liner form.',415);
      const values=new URLSearchParams(await readLimited(request,2048));
      const name=requiredText(values.get('name'),'Caller',24),message=requiredText(values.get('line'),'One-liner',120);
      if(/[\x00-\x1f\x7f]/.test(name+message))throw new Issue('Enter a single line.');
      await db.prepare('INSERT INTO guest_entries(slug,name,message,created) VALUES(?,?,?,?)').bind(wallKey,name,message,new Date().toISOString()).run();
      return new Response(null,{status:303,headers:{...defaultHeaders,Location:address(id)}});
    }
    if(openWall){
      const entries=await db.prepare('SELECT name,message FROM guest_entries WHERE slug=? ORDER BY id DESC LIMIT 12').bind(wallKey).all();
      for(const b of page.bbsScreen.filter(b=>b.widget==='bbs-wall'))b.text += entries.results.map(r=>'\n'+r.name+': '+r.message).join('');
    }
    const screen=hostTerminal(pages,id,columns);
    if(path==="bbs/"){
      const destination=r=>r.attachment?memberUrl(slug)+r.href:r.href;
      const key=(u.searchParams.get('command')||'').trim().toUpperCase();
      if(key){
        const route=key==='H'?{page:'home'}:RetroBbs.command(screen,key);
        if(route)return new Response(null,{status:302,headers:{...defaultHeaders,Location:route.page?address(route.page):destination(route.resource)}});
      }
      const menu=screen.links.map((target,i)=>'<li><a href="'+e(address(target))+'">'+e(screen.linkKeys?.[i]||String(i+1))+'  '+e(pages.get(target).title)+'</a></li>');
      const files=screen.resources.map(r=>'<li><a '+(r.attachment?'download ':'')+'href="'+e(destination(r))+'">'+e(r.key)+'  '+e(r.text)+'</a></li>');
      const widths=[32,40,80].map(w=>'<a href="'+e(address(id,w))+'">'+w+'</a>').join(' / ');
      const stem=memberUrl(slug)+(id==='home'?'terminal':'page-'+id+'-terminal');
      const wallForm=openWall?'<form method="post" action="'+e(address(id))+'"><label>Caller <input name="name" required maxlength="24"></label> <label>One-liner <input name="line" required maxlength="120"></label> <button>Post line</button></form>':'';
      const form='<form method="get">'+(surfing?'<input type="hidden" name="surfer" value="1">':'')+'<input type="hidden" name="page" value="'+e(id)+'"><input type="hidden" name="columns" value="'+columns+'"><label>Command <input name="command" size="4" maxlength="3"></label> <button>Enter</button></form>';
      const markup='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(page.title)+'</title></head><body bgcolor="#080e0a" text="#a6e49d" link="#c4ed9e" vlink="#abd5ba"><pre>'+RetroBbs.toHTML(screen)+'</pre>'+wallForm+'<hr>'+form+(key?'<p>Unknown command.</p>':'')+'<ul>'+menu.concat(files).join('')+'</ul><p><a href="'+e(address('home'))+'">Main menu</a> | Columns '+widths+'</p><p>Screen download: <a download href="'+stem+'.txt?columns='+columns+'">ASCII</a> · <a download href="'+stem+'.ans?columns='+columns+'">ANSI / CP437</a> · <a download href="'+stem+'.pet">40-column PETSCII</a></p></body></html>';
      return communityResponse(markup,u);
    }
    const bytes=RetroBbs.bytes(screen,ext==='ans'?'ansi':ext==='pet'?'petscii':'ascii');
    return new Response(request.method==='HEAD'?null:bytes,{headers:{...defaultHeaders,'Content-Type':ext==='txt'?'text/plain; charset=us-ascii':'application/octet-stream',...(ext==='txt'?{}:{'Content-Disposition':'attachment; filename="'+path+'"'})}});
  }
  if(!path && !u.pathname.endsWith("/"))return new Response(null,{status:301,headers:{Location:memberUrl(slug)}});
  const child=path.match(/^page-([0-9a-f]{32})(?:-(modern|classic|phone|text))?\.html$/);
  if(!child && !/^(?:(?:index|modern|classic|phone|text)\.html)?$/.test(path))throw new Issue("Page not found.",404);
  const id=child?child[1]:"home", ed=child?child[2]||"":path.replace(".html","").replace("index","");
  const record=await db.prepare("SELECT body FROM revision_pages WHERE rev=? AND page=?").bind(row.rev,id).first();
  if(!record)throw new Issue("Page not found.",404);
  const page=JSON.parse(record.body),paths=new Map(),home=memberUrl(slug);
  const classicSuffix=new Map();
  if(ed==='classic' && page.items.some(o=>o.media)){
    const nums=[...new Set(page.items.filter(o=>o.media).map(o=>o.classic||o.media))];
    const {results}=await db.prepare("SELECT num,substr(src,6,instr(src,';')-6) AS mime FROM revision_media WHERE rev=? AND num IN (SELECT value FROM json_each(?))").bind(row.rev,JSON.stringify(nums)).all();
    for(const file of results)classicSuffix.set(file.num,'.'+mediaExtension(file.mime));
  }
  let views=0;
  if(row.counter){
    const standby=u.searchParams.get("yester-standby")==="1";
    const count=request.method==="GET" && !standby?await db.prepare("INSERT INTO site_counters(slug,views) VALUES(?,1) ON CONFLICT(slug) DO UPDATE SET views=views+1 RETURNING views").bind(slug).first():await db.prepare("SELECT views FROM site_counters WHERE slug=?").bind(slug).first();
    views=(count?.views||0)+(standby?1:0);
  }
  for(const item of page.items){
    if(item.widget==="guestbook")item.href=home+"guestbook/";
    if(item.widget==="webring"&&row.listed)item.href=item.ringRole==="directory"?"/members/":"/api/discover/"+(item.ringRole==="previous"?"previous":"next")+"?from="+slug;
    if(item.widget==="counter"){
      item.text=String(views).padStart(Math.min(12,item.text.length)||6,"0");item.kind="text";item.src="";item.font_family="Courier";item.bold=true;item.color="#ffd572";item.fill="#171610";item.align="center";
    }else if(item.media){
      const base=home+"media/"+row.rev+"/",classic=item.classic||item.media;
      paths.set(item.id,[base+item.media,base+classic+(classicSuffix.get(classic)||'')]);
    }
  }
  for(const item of page.items)if(item.posterMedia){
    const [normal,classic]=paths.get(item.id)||['',''];
    paths.set(item.id,[normal,classic,home+'media/'+row.rev+'/'+item.posterMedia+'.GIF']);
  }
  let output=hostRender(page,id,ed,paths);
  if(page.bbsScreen || page.profile==="text" || page.items.some(o=>o.widget?.startsWith("bbs-"))){
    const terminal=id==="home"?"terminal.txt":"page-"+id+"-terminal.txt";
    output=output.replace("</body>",'<p align="center"><a href="bbs/?page='+id+'">Open BBS</a> | Terminal text: '+[32,40,80].map(w=>'<a href="'+terminal+'?columns='+w+'">'+w+' columns</a>').join(' | ')+'</p></body>');
  }
  if(row.listed)output=output.replace("</body>",'<p align="center"><a href="/api/discover/next?from='+slug+'">Next site in the ring</a> | <a href="/api/discover/random">Random site</a></p></body>');
  const surfing=u.searchParams.get("surfer")==="1";
  if (page.soundtrack && !surfing) {
    const src=e(page.soundtrack);
    const player=ed==="text" || ed==="classic" || (!ed && page.profile==="text")
      ? '<p><a href="'+src+'">Listen to this page</a></p>' : '<audio controls autoplay loop preload="none" aria-label="Page soundtrack" src="'+src+'"></audio>';
    output=output.replace("</body>",player+"</body>");
  }
  if (surfing) output=output.replace("</body>",'<meta name="yestersites-sound" content="'+e(page.soundtrack||'')+'"><script>'+surferBridge+'</script></body>');
  const response=html(output);
  let policy=publicHtmlHeaders["Content-Security-Policy"];
  if(page.items.some(o=>o.widget==="video-player" || o.playerSkin==="hardware" || o.playerSkin==="original"))policy=policy.replace("img-src 'self'","img-src 'self' data:");
  const hashes=surfing?["'sha256-"+surferBridgeHash+"'"]:[];
  if(output.includes("<script>"+RetroMedia.script+"</script>")){
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(RetroMedia.script));
    hashes.push("'sha256-"+btoa(String.fromCharCode(...new Uint8Array(digest)))+"'");
  }
  if(hashes.length)policy+="; script-src "+hashes.join(" ");
  if(page.soundtrack || page.items.some(RetroMedia.isPlayer))policy+="; media-src https:";
  const allowed=new Set(["https://www.youtube-nocookie.com","https://rumble.com","https://archive.org"]);
  if(page.items.some(o=>o.widget==='flash-movie'||o.widget==='flash-book'))allowed.add(RetroCraft.player);
  if(page.items.some(o=>o.widget==='game-cartridge'))allowed.add(RetroCraft.arcade);
  if(page.items.some(o=>o.widget==='html-block'))allowed.add("'self'");
  for(const pane of page.items.filter(RetroMedia.isFrame)){
    for(const src of [pane.href,pane.otherHref].filter(Boolean))allowed.add(src.startsWith("page:")?"'self'":new URL(src).origin);
  }
  policy+="; frame-src "+[...allowed].join(" ");
  response.headers.set("Content-Security-Policy",policy);
  return response;
}

const hostTerminal=(()=>{
  const page=(records,id)=>records.get(id);
  function wrap(text, width) {
    const lines = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = '';
      for (let word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && (line + ' ' + word).length > width) {
          lines.push(line);
          line = '';
        }
        while (word.length > width) {
          lines.push(word.slice(0, width));
          word = word.slice(width);
        }
        line += (line ? ' ' : '') + word;
      }
      lines.push(line);
    }
    return lines;
  }
  function terminal(doc, id, columns = 32) {
    const p = page(doc, id),
      links = [], resources = [],
      body = [];
    const ascii = (s) =>
      s
        .normalize('NFKD')
        .replace(/[’‘]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/[^\x20-\x7e\n]/g, '');
    const ordered = [...p.items].sort((a,b)=>a.y-b.y||a.x-b.x);
    const authored = p.bbsScreen || ordered.filter(o => o.widget?.startsWith('bbs-'));
    if(p.bbsScreen || authored.length)return RetroBbs.authored(authored,columns,key=>page(doc,key)?.title||key,id,wrap);
    const lines = [...wrap(ascii(p.title.toUpperCase()), columns), ''];
    for (const o of ordered) {
      const t = ascii(o.text.trim());
      if (o.href.startsWith('page:')) {
        const target = o.href.slice(5);
        if (target !== id) {
          links.push(target);
          lines.push(...wrap(links.length + '  ' + (t || page(doc, target).title), columns));
        }
      } else if (
        t &&
        t.toLowerCase().replace(/\s+/g, ' ') !== p.title.toLowerCase() &&
        !['/', '|'].includes(t)
      ) {
        body.push(...wrap(o.kind === 'image' ? '[' + t + ']' : t, columns), '');
      }
    }
    return { lines: [...lines, '', ...body], links,resources };
  }

  return terminal;
})();
