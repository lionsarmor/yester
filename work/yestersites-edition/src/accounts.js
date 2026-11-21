const uuidPattern=/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/;
const publicEditor='https://retropage.yestersites.com/';
function accountWindow(title,content,status=200,allowImageData=false){
  const markup='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(title)+' · YesterSites</title><link rel="stylesheet" href="/account/desk.css"><link rel="stylesheet" href="/assets/member-nav.css"><script defer src="/assets/member-nav.js"></script></head><body><main><header><img src="/account/pencil.png" width="20" height="20" alt="">YesterSites · Member Services<span class="ys-members" data-member-nav><a data-signin href="https://yestersites-webring.jamesmweeksjr.chatgpt.site/signin/">Sign in</a><a data-join href="https://yestersites-webring.jamesmweeksjr.chatgpt.site/signup/">Join</a><details data-account hidden><summary><span data-handle>Account</span></summary><span class="ys-menu"><a href="https://yestersites-webring.jamesmweeksjr.chatgpt.site/account/">My Sites</a><a href="https://yestersites-webring.jamesmweeksjr.chatgpt.site/account/profile/">My profile</a><a href="https://yestersites-webring.jamesmweeksjr.chatgpt.site/signout/">Sign out</a></span></details></span></header><section><img class="mast" src="/assets/yestersites.png" alt="YesterSites"><h1>'+e(title)+'</h1>'+content+'</section><footer><a href="https://yestersites.com/">Neighborhood</a><a href="https://yestersites.com/browse/">YESTER</a></footer></main></body></html>';
  return new Response(markup,{status,headers:{...defaultHeaders,"Content-Type":"text/html; charset=utf-8","Referrer-Policy":"same-origin","Content-Security-Policy":"default-src 'none'; img-src 'self'"+(allowImageData?" data:":"")+"; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
function accountReturn(u){
  const next=u.searchParams.get('returnTo')||'';
  if(next==='/account/profile/')return next;
  if(next.startsWith('/api/member-badge/connect?to=')){
    const target=badgeDestination(new URL(next,u.origin).searchParams.get('to'));
    if(target)return '/api/member-badge/connect?to='+encodeURIComponent(target);
  }
  if(/^\/(?:studio|desktop\/publish)\/(?:\?[^#]*)?$/.test(next))return next;
  if(/^\/account\/sites\/[a-z0-9-]{1,40}\/(edit|history|backup)(?:\?publish=1)?$/.test(next))return next;
  return /^\/account\/publish\/\?draft=[\da-f-]{36}$/.test(next)?next:'/account/';
}
async function accountRoute(request,u,db,owner){
  const p=u.pathname,back=accountReturn(u),query='?returnTo='+encodeURIComponent(back);
  const redirect=path=>new Response(null,{status:303,headers:{...defaultHeaders,Location:path}});
  const profile=owner?await db.prepare('SELECT handle FROM webmasters WHERE owner=?').bind(owner).first():null;
  if(p==='/api/address' && request.method==='GET'){
    const slug=u.searchParams.get('slug')||'';
    if(!slugPattern.test(slug)||slug.length>40)throw new Issue('Use 1–40 lowercase letters, numbers or interior hyphens.');
    const row=await db.prepare("SELECT owner_id,json_type(blocks_json) kind FROM member_sites WHERE slug=?").bind(slug).first();
    return Response.json({slug,canonicalUrl:assignedUrl(slug),state:reservedHosts.has(slug)?'claimed':!row?'available':owner && row.owner_id===owner && row.kind==='object'?'owned':'claimed'},{headers:{...defaultHeaders,'Access-Control-Allow-Origin':'*'}});
  }
  if(p==='/api/editor/handoff' && request.method==='POST'){
    const origin=request.headers.get('Origin');
    if(!['https://yestersites.com','https://retropage.yestersites.com','http://127.0.0.1:43761',u.origin].includes(origin))throw new Issue('Open Publish from Retro Page.',403);
    if(request.headers.get('Content-Type')?.split(';')[0]!=='text/plain')throw new Issue('Use the Retro Page publish form.',415);
    const raw=await readLimited(request,releaseLimit+32);
    if(!raw.startsWith('project='))throw new Issue('Missing project.');
    let doc;try{doc=JSON.parse(raw.slice(8));}catch{throw new Issue('Could not read the project.');}
    if(!doc || !Array.isArray(doc.items) || typeof doc.title!=='string')throw new Issue('Choose a Retro Page project.');
    const payload=JSON.stringify(doc).replace(/</g,'\\u003c');
    return accountWindow('Publish your site','<p id="state" role="status">Preparing your pages and pictures…</p><script id="transfer" type="application/json">'+payload+'</script><script src="/account/transfer.js" defer></script>');
  }
  if(p==='/api/editor/publish' && request.method==='POST'){
    if(!owner)throw new Issue('Sign in to publish.',401);
    checkOrigin(request,u);
    if(!profile && !await db.prepare('SELECT 1 FROM member_sites WHERE owner_id=? LIMIT 1').bind(owner).first())throw new Issue('Create your webmaster account first.',403);
    const input=await readJSON(request,releaseLimit*2+4096);
    if(!uuidPattern.test(input.requestId))throw new Issue('Missing publication number.');
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([owner,input.document?.slug,input.requestId]))));
    const h=Array.from(digest.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
    const rev=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-'),slug=input.document?.slug;
    if(typeof slug!=='string' || !slugPattern.test(slug)||slug.length>40)throw new Issue('Choose a valid site address.');
    const receipt=async()=>await db.prepare('SELECT 1 FROM site_revisions r JOIN member_sites s ON r.slug=s.slug WHERE r.id=? AND s.slug=? AND s.owner_id=?').bind(rev,slug,owner).first();
    const success=()=>json({slug,url:publicMemberUrl(slug),canonicalUrl:assignedUrl(slug),revision:rev});
    if(await receipt())return success();
    if(profile && !input.document.byline)input.document.byline=profile.handle;
    try{return await publishRelease(input.document,u.origin,owner,db,rev,input.source);}catch(error){if(await receipt())return success();throw error;}
  }
  if(!['GET','HEAD','POST'].includes(request.method))throw new Issue('Method not allowed.',405);
  if(['/signin/','/signup/','/recover/','/signout/','/account/recovery/'].includes(p))return credentialsRoute(request,u,db,owner,back);
  const signup='/signup/'+query,signin='/signin/'+query;
  if(request.method==='POST')throw new Issue('Method not allowed.',405);
  if(p==='/account/publish/'){
    const key=u.searchParams.get('draft')||'';
    if(!uuidPattern.test(key))return redirect(publicEditor);
    const pending=u.pathname+u.search,params='?returnTo='+encodeURIComponent(pending);
    if(!owner)return redirect('/signin/'+params);
    if(!profile && !await db.prepare('SELECT 1 FROM member_sites WHERE owner_id=? LIMIT 1').bind(owner).first())return redirect('/signup/'+params);
    return accountWindow('Publishing desk','<p id="state" role="status">Opening your project…</p><form id="retry" hidden><label>Site address <input name="slug" maxlength="40" required pattern="[a-z0-9]+(-[a-z0-9]+)*"></label><output id="availability"></output><button>Publish site</button></form><div id="result"></div><script src="/desktop/publish/format.js" defer></script><script src="/desktop/publish/member-storage.js" defer></script><script src="/desktop/publish/craft.js" defer></script><script src="/desktop/publish/media.js" defer></script><script src="/desktop/publish/objects.js" defer></script><script src="/desktop/publish/presets.js" defer></script><script src="/desktop/publish/bbs-codec.js" defer></script><script src="/desktop/publish/project.js" defer></script><script src="/desktop/publish/prepare.js" defer></script><script src="/account/transfer.js" defer></script>',200,true);
  }
  if(p==='/account/' && !owner)return redirect(signin);
  if(p!=='/account/')return redirect(back);
  const {results}=await db.prepare('SELECT slug,title,updated_at FROM member_sites WHERE owner_id=? ORDER BY updated_at DESC').bind(owner).all();
  if(!profile && !results.length)return redirect(signup);
  return accountWindow('My homepages',(profile?'<p>Signed in as <b>'+e(profile.handle)+'</b></p>':'')+(results.length?'<ul>'+results.map(r=>{
    const root='/account/sites/'+r.slug+'/';
    return '<li class="site-card"><strong>'+e(r.title)+'</strong><small>Last published '+e(r.updated_at.slice(0,10))+'</small><nav><a href="'+root+'edit">Edit</a> · <a href="'+publicMemberUrl(r.slug)+'">Visit</a> · <a href="'+root+'edit?publish=1">Publish changes</a> · <a href="'+root+'history">Version history / Restore</a> · <a href="'+root+'backup">Download backup</a></nav></li>';
  }).join('')+'</ul>':'<p>Your first homepage starts in Retro Page.</p>')+'<a class="button" href="/account/profile/">Edit my profile</a> <a class="button primary" href="'+publicEditor+'">Open Retro Page</a> <form method="post" action="/signout/"><button>Sign out</button></form><details><summary>Account recovery</summary><form action="/account/recovery/" method="post"><label>Current password<input type="password" name="password" autocomplete="current-password" maxlength="256" required></label><button>Generate recovery key</button></form></details>');
}
