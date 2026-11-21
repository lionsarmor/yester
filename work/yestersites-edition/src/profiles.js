const profileStamps={mushroom:'Bog mushroom',planet:'Ringed planet',disk:'Floppy disk',moon:'Crescent moon',tape:'Mix tape',flower:'Daisy'};
const profileInks={plum:'#664578',lagoon:'#176465',cobalt:'#304789',berry:'#863956'};
function stampImage(stamp){
  return '<img class="profile-stamp" width="64" height="64" src="/assets/stamps/'+stamp+'.png" alt="'+e(profileStamps[stamp])+'">';
}
async function editProfile(request,u,db,owner){
  if(!owner)return new Response(null,{status:303,headers:{...defaultHeaders,Location:'/signin/?returnTo=%2Faccount%2Fprofile%2F'}});
  const key=await accountShelf(db,owner);
  const member=await db.prepare('SELECT handle FROM webmasters WHERE owner=?').bind(owner).first();
  if(!member)throw new Issue('Create a webmaster account first.',403);
  const current=await db.prepare('SELECT * FROM webmaster_cards WHERE shelf=?').bind(key).first();
  const sites=(await db.prepare('SELECT slug,title FROM member_sites WHERE owner_id=? AND listed=1 ORDER BY title,slug').bind(owner).all()).results;
  const defaults={name:member.handle,bio:'',stamp:'planet',ink:'lagoon',featured:'',visible:1};
  let card=current||defaults,error='';
  if(request.method==='POST'){
    checkOrigin(request,u);
    const form=new URLSearchParams(await readLimited(request,8192));
    card={name:(form.get('name')||'').trim(),bio:(form.get('bio')||'').trim(),stamp:form.get('stamp'),ink:form.get('ink'),featured:form.get('featured')||'',visible:form.has('visible')?1:0};
    if(!card.name || card.name.length>40 || card.bio.length>400)error='Use a display name of 1–40 characters and a bio of up to 400 characters.';
    else if(!Object.hasOwn(profileStamps,card.stamp)||!Object.hasOwn(profileInks,card.ink))error='Choose an available stamp and ink.';
    else if(card.featured && !sites.some(s=>s.slug===card.featured))error='Choose a listed site you own.';
    if(!error){
      await db.prepare('INSERT INTO webmaster_cards(shelf,name,bio,stamp,ink,featured,visible) VALUES(?,?,?,?,?,?,?) ON CONFLICT(shelf) DO UPDATE SET name=excluded.name,bio=excluded.bio,stamp=excluded.stamp,ink=excluded.ink,featured=excluded.featured,visible=excluded.visible')
        .bind(key,card.name,card.bio,card.stamp,card.ink,card.featured,card.visible).run();
      return new Response(null,{status:303,headers:{...defaultHeaders,Location:'/account/profile/?saved=1'}});
    }
  }else if(!['GET','HEAD'].includes(request.method))throw new Issue('Method not allowed.',405);
  const options=(values,selected)=>Object.entries(values).map(([value,label])=>'<option value="'+e(value)+'"'+(value===selected?' selected':'')+'>'+e(label)+'</option>').join('');
  const stamps=Object.entries(profileStamps).map(([value,label])=>'<label class="stamp-pick"><input type="radio" name="stamp" value="'+value+'" '+(card.stamp===value?'checked':'')+'>'+stampImage(value)+e(label)+'</label>').join('');
  const fields='<form method="post" action="/account/profile/"><label>Display name<input name="name" maxlength="40" required value="'+e(card.name)+'"></label><label>About my corner of the web<textarea name="bio" maxlength="400" rows="4">'+e(card.bio)+'</textarea></label><fieldset class="stamp-options"><legend>Webmaster stamp</legend>'+stamps+'</fieldset><label>Card ink<select name="ink">'+options({plum:'Plum',lagoon:'Lagoon',cobalt:'Cobalt',berry:'Berry'},card.ink)+'</select></label><label>Featured homepage<select name="featured">'+options(Object.fromEntries([['','No featured site'],...sites.map(s=>[s.slug,s.title])]),card.featured)+'</select></label><label class="card-visible"><input type="checkbox" name="visible" '+(card.visible?'checked':'')+'> Show my webmaster card on my public shelf</label><button class="primary">Save profile</button></form>';
  return accountWindow('My profile','<p><a href="/account/">My Sites</a> · <a href="'+shelfUrl(key)+'">View public shelf</a></p>'+(error?'<p role="alert">'+e(error)+'</p>':u.searchParams.has('saved')?'<p role="status">Profile saved.</p>':'')+fields,error?400:200);
}
async function publicProfile(db,key,cursor,owner){
  const card=await db.prepare('SELECT * FROM webmaster_cards WHERE shelf=? AND visible=1').bind(key).first();
  const first=await db.prepare('SELECT slug,byline FROM member_sites WHERE creator_key=? AND listed=1 ORDER BY slug LIMIT 1').bind(key).first();
  if(!card&&!first)return html(document('Webmaster not found','<h1>No listed homepages here</h1><a href="/members/">Member directory</a>'),404);
  const {results}=await db.prepare('SELECT slug,title,profile,snippet FROM member_sites WHERE creator_key=? AND listed=1 AND slug>? ORDER BY slug LIMIT 51').bind(key,cursor).all();
  const name=card?.name||first.byline||first.slug,ink=profileInks[card?.ink]||profileInks.plum;
  const pin=card?.featured && await db.prepare('SELECT slug,title FROM member_sites WHERE creator_key=? AND listed=1 AND slug=?').bind(key,card.featured).first();
  const list=results.slice(0,50).map(s=>'<li><a href="'+publicMemberUrl(s.slug)+'">'+e(s.title)+'</a><p>'+e(s.snippet)+'</p></li>').join('');
  const face='<header class="keeper">'+stampImage(card?.stamp||'disk')+'<div><small>YesterSites webmaster</small><h1>'+e(name)+'</h1></div></header>';
  return html(document(name+'’s shelf',(await directoryMemberNav(owner,db))+face+(card?.bio?'<p class="bio">'+e(card.bio)+'</p>':'')+(pin?'<aside>Featured homepage<br><a href="'+publicMemberUrl(pin.slug)+'">'+e(pin.title)+'</a></aside>':'')+'<h2>Homepages</h2>'+(list?'<ul>'+list+'</ul>':'<p>No listed homepages yet.</p>')+(results.length>50?'<a href="'+shelfUrl(key)+'?cursor='+results[49].slug+'">Next page</a>':'')+'<p><a href="/members/">Member directory</a> · <a href="https://yestersites.com/">Neighborhood</a></p>',
    'body{max-width:44rem;margin:1rem auto;padding:1rem;background:#f6eedb;color:#292535;font:17px Georgia,serif}h2{font-size:1.4em}.keeper{display:flex;align-items:center;gap:16px;padding:16px;border:4px double white;background:'+ink+';color:white}.keeper h1{margin:.1em 0}.profile-stamp{image-rendering:pixelated}.bio{white-space:pre-wrap;overflow-wrap:anywhere}aside{background:#fff7ce;border:1px solid #ae9a72;padding:12px}li p{margin:.2em 0 1em}'));
}
