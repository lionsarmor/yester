const serviceHome='https://yestersites-webring.jamesmweeksjr.chatgpt.site';
const originalEdition=slug=>Object.hasOwn(founderFiles,slug)?founderFiles[slug]:null;
function downloadFile(data,filename,type){
  return new Response(data,{headers:{...defaultHeaders,'Content-Type':type,'Content-Disposition':'attachment; filename="'+filename+'"'}});
}
async function originalBytes(file){
  const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
  return file.gz?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):bytes;
}
function originalText(src,fields,changes){
  let end=0,out='';
  for(const [index,[a,b]] of fields.entries()){
    out+=src.slice(end,a)+(Object.hasOwn(changes,index)?e(changes[index]):src.slice(a,b));end=b;
  }
  return out+src.slice(end);
}
async function serveOriginal(request,u,slug,path,changes={}){
  const archive=originalEdition(slug),name=path||'index.html';
  if(!archive || !Object.hasOwn(archive.files,name))throw new Issue('File not found.',404);
  const f=archive.files[name],bytes=await originalBytes(f);
  if(!f.text)return new Response(request.method==='HEAD'?null:bytes,{headers:{...defaultHeaders,'Content-Type':f.mime}});
  let page=originalText(new TextDecoder().decode(bytes),f.text,changes[name]||{});
  // The original visit helper redirects away from updated editions. Visits here are counted by the host.
  page=page.replace(/<script defer src="\/assets\/member-visit\.js"><\/script>/g,'')
    .replace(/(href|src)="\/(assets\/[^"]*|favicon\.ico[^"]*|index\.html)"/g,'$1="https://yestersites.com/$2"');
  if(u.searchParams.get('surfer')==='1')page=page.replace('</body>','<script>'+surferBridge+'</script></body>');
  const scripts=["'self'",...(f.hashes||[]),"'sha256-"+surferBridgeHash+"'"].join(' ');
  return new Response(request.method==='HEAD'?null:page,{headers:{...defaultHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src "+scripts+"; media-src https:; frame-src 'self' https://archive.org https://rumble.com https://www.youtube-nocookie.com; connect-src 'self'; base-uri 'none'; form-action 'self'"}});
}
async function loadEditable(db,row,rev){
  const packed=await db.prepare('SELECT src FROM revision_media WHERE rev=? AND num<0 ORDER BY num DESC').bind(rev).all();
  if(packed.results.length)return JSON.parse(packed.results.map(p=>p.src).join(''));
  const [pages,pictures]=await Promise.all([
    db.prepare('SELECT page,body FROM revision_pages WHERE rev=? ORDER BY rowid').bind(rev).all(),
    db.prepare('SELECT num,src FROM revision_media WHERE rev=? AND num>0').bind(rev).all()]);
  const images=new Map(pictures.results.map(r=>[r.num,r.src]));
  const decoded=pages.results.map(r=>{
    const p=JSON.parse(r.body);
    for(const o of p.items){
      if(o.media){o.src=images.get(o.media);delete o.media;}
      if(o.classic){o.classic_src=images.get(o.classic);delete o.classic;}
      if(o.posterMedia){o.fallbackPoster=images.get(o.posterMedia);delete o.posterMedia;}
    }
    return {...p,page_id:r.page};
  });
  const home=decoded.find(p=>p.page_id==='home');
  if(!home)throw new Issue('No saved project found.',404);
  delete home.page_id;
  return {...home,...RetroTopics.unpack(JSON.parse(row.keywords_json||'[]')),slug:row.slug,listed:!!row.listed,pages:decoded.filter(p=>p!==home)};
}
async function mySitesAction(request,u,db,owner,slug,action){
  if(!owner)return new Response(null,{status:303,headers:{Location:'/signin/?returnTo='+encodeURIComponent(u.pathname+u.search)}});
  const row=await db.prepare('SELECT * FROM member_sites WHERE owner_id=? AND slug=?').bind(owner,slug).first();
  if(!row)throw new Issue('Site not found.',404);
  const ptr=JSON.parse(row.blocks_json),root='/account/sites/'+slug+'/',archive=originalEdition(slug);
  const meta=ptr.release?JSON.parse((await db.prepare('SELECT metadata FROM site_revisions WHERE id=? AND slug=?').bind(ptr.release,slug).first()).metadata):{};
  const isOriginal=!!archive && (ptr.stock || meta.original);
  if(request.method==='POST'){
    if(request.headers.get('origin')!==u.origin)throw new Issue('Submit from My Sites.',403);
    if(action==='restore'){
      const f=new URLSearchParams(await readLimited(request,2048)),rev=f.get('revision');
      if(!uuidPattern.test(rev||''))throw new Issue('Select a version.');
      const prev=await db.prepare('SELECT metadata FROM site_revisions WHERE slug=? AND id=?').bind(slug,rev).first();
      if(!prev)throw new Issue('Version not found.',404);
      const m=JSON.parse(prev.metadata),r=await db.prepare('UPDATE member_sites SET blocks_json=?,title=?,profile=?,theme=?,listed=?,links_json=?,snippet=?,keywords_json=?,updated_at=? WHERE slug=? AND owner_id=? AND blocks_json=?').bind(JSON.stringify({release:rev,counter:!!m.counter}),m.title,m.profile,m.theme,m.listed,JSON.stringify(m.links),m.snippet,JSON.stringify(m.keywords),new Date().toISOString(),slug,owner,row.blocks_json).run();
      if(!r.meta.changes)throw new Issue('The site changed. Reopen its history.',409);
    }else if(action==='original' && isOriginal){
      const f=new URLSearchParams(await readLimited(request,240000)),file=f.get('file'),base=f.get('version');
      if(base!==(ptr.release||archive.version))throw new Issue('A newer revision exists. Reopen the editor.',409);
      const spec=Object.hasOwn(archive.files,file)?archive.files[file]:null;
      if(!spec?.text)throw new Issue('Choose an HTML page.');
      const current=meta.changes||{},patch={...(current[file]||{})},source=new TextDecoder().decode(await originalBytes(spec));
      for(const [i,[a,b]] of spec.text.entries()){
        const v=f.get('t'+i);if(v===null)continue;
        if(v.length>8000)throw new Issue('Shorten this passage.');
        if(v===source.slice(a,b))delete patch[i];else patch[i]=v;
      }
      const when=new Date().toISOString(),id=crypto.randomUUID(),next=JSON.stringify({release:id});
      const info={title:row.title,profile:row.profile,theme:row.theme,listed:row.listed,links:JSON.parse(row.links_json),snippet:row.snippet,keywords:JSON.parse(row.keywords_json),original:true};
      const result=await db.batch([
        db.prepare('INSERT OR IGNORE INTO site_revisions(id,slug,created,metadata) VALUES(?,?,?,?)').bind(archive.version,slug,'2026-11-20T00:00:00Z',JSON.stringify(info)),
        db.prepare('UPDATE member_sites SET blocks_json=?,updated_at=? WHERE owner_id=? AND slug=? AND blocks_json=?').bind(next,when,owner,slug,row.blocks_json),
        db.prepare('INSERT INTO site_revisions(id,slug,created,metadata) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM member_sites WHERE slug=? AND blocks_json=?)').bind(id,slug,when,JSON.stringify({...info,changes:{...current,[file]:patch}}),slug,next)]);
      if(!result[1].meta.changes)throw new Issue('A newer revision exists. Reopen the editor.',409);
    }else throw new Issue('Unknown action.',404);
    return new Response(null,{status:303,headers:{Location:root+'history'}});
  }
  if(request.method!=='GET')throw new Issue('Method not allowed.',405);
  if(action==='history'){
    const {results}=await db.prepare('SELECT id,created FROM site_revisions WHERE slug=? ORDER BY created DESC,rowid DESC LIMIT 100').bind(slug).all();
    if(isOriginal && !results.some(r=>r.id===archive.version))results.push({id:archive.version,created:'2026-11-20T00:00:00Z'});
    return accountWindow('Version history · '+row.title,results.map(r=>'<p>'+e(r.created)+' '+(r.id===(ptr.release||archive?.version)?' · Current':'<form method="post" action="restore"><input type="hidden" name="revision" value="'+e(r.id)+'"><button>Restore this version</button></form>')+'</p>').join('')+'<p><a href="/account/">My Sites</a></p>');
  }
  if(isOriginal){
    if(action==='backup'){
      const files=[];for(const [name,file] of Object.entries(archive.files)){
        let data=await originalBytes(file);if(file.text && meta.changes?.[name])data=new TextEncoder().encode(originalText(new TextDecoder().decode(data),file.text,meta.changes[name]));
        files.push({name,data});
      }
      return downloadFile(makeOriginalZip(files),slug+'.zip','application/zip');
    }
    if(!['edit','original'].includes(action))throw new Issue('Unknown action.',404);
    const files=Object.keys(archive.files).filter(k=>archive.files[k].text),name=u.searchParams.get('file')||'index.html';
    if(!files.includes(name))throw new Issue('Choose a page.',404);
    const file=archive.files[name],src=new TextDecoder().decode(await originalBytes(file)),changes=meta.changes?.[name]||{};
    return accountWindow('Edit '+row.title,'<nav>'+files.map(k=>'<a href="?file='+encodeURIComponent(k)+'">'+e(k)+'</a>').join(' · ')+'</nav><h2>'+e(name)+'</h2><form method="post" action="original"><input type="hidden" name="file" value="'+e(name)+'"><input type="hidden" name="version" value="'+e(ptr.release||archive.version)+'">'+file.text.map(([a,b],i)=>'<label>Passage '+(i+1)+'<textarea name="t'+i+'" maxlength="8000">'+e(changes[i]??src.slice(a,b))+'</textarea></label>').join('')+'<button class="primary">Publish changes</button></form><a href="/account/">My Sites</a>');
  }
  if(!ptr.release)return new Response(null,{status:303,headers:{Location:'/studio/?site='+slug}});
  if(action==='backup'||action==='project'){
    const project=await loadEditable(db,row,ptr.release);
    return action==='backup'?downloadFile(JSON.stringify(project),slug+'.yst','application/json'):json(project);
  }
  if(action!=='edit')throw new Issue('Unknown action.',404);
  // The editor opens as a top-level document. This short-lived token can read only this revision once.
  const key=token(),now=Math.floor(Date.now()/1000);
  await db.batch([
    db.prepare('DELETE FROM editor_grants WHERE expires<=?').bind(now),
    db.prepare('INSERT INTO editor_grants(digest,session,slug,revision,expires) VALUES(?,?,?,?,?)')
      .bind(await digest(key),await digest(cookieToken(request)),slug,ptr.release,now+180)
  ]);
  const fragment=new URLSearchParams({open:key});
  if(u.searchParams.get('publish')==='1')fragment.set('publish','1');
  return new Response(null,{status:303,headers:{...defaultHeaders,Location:publicEditor+'#'+fragment,'Referrer-Policy':'no-referrer'}});
}

async function redeemEditor(request,db){
  const origin=request.headers.get('Origin');
  if(!['https://yestersites.com','https://retropage.yestersites.com'].includes(origin))throw new Issue('Open the project through My Sites.',403);
  const headers={...defaultHeaders,'Access-Control-Allow-Origin':origin,Vary:'Origin'};
  if(request.method!=='POST')return Response.json({error:'Use the editor to open this link.'},{status:405,headers});
  const key=await readLimited(request,80);
  if(!/^[a-f0-9]{64}$/.test(key))return Response.json({error:'Invalid editor link.'},{status:400,headers});
  const now=Math.floor(Date.now()/1000);
  const grant=await db.prepare('DELETE FROM editor_grants WHERE digest=? AND expires>? RETURNING session,slug,revision').bind(await digest(key),now).first();
  const row=grant && await db.prepare('SELECT s.* FROM member_sites s JOIN member_sessions a ON a.owner=s.owner_id WHERE a.digest=? AND a.expires>? AND s.slug=?').bind(grant.session,now,grant.slug).first();
  if(!row)return Response.json({error:'This editor link expired. Open the site again from My Sites.'},{status:410,headers});
  return Response.json(await loadEditable(db,row,grant.revision),{headers});
}
