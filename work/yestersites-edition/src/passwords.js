const sessionTTL=30*24*60*60;
const hexBytes=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>hexBytes(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value){return hexBytes(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
function equalHash(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let delta=0;for(let i=0;i<a.length;i++)delta|=a.charCodeAt(i)^b.charCodeAt(i);return delta===0;}
async function passwordKey(value,salt,rounds){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
  return hexBytes(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:new TextEncoder().encode(salt),iterations:rounds},key,256));
}
let supportedRounds;
async function newHash(password){
  const salt=token();let rounds=supportedRounds||220000;
  try{const hash=await passwordKey(password,salt,rounds);supportedRounds=rounds;return {hash,salt,rounds};}
  catch(error){if(supportedRounds || !/iteration/i.test(error.message))throw error;
    rounds=100000;const hash=await passwordKey(password,salt,rounds);supportedRounds=rounds;return {hash,salt,rounds};}
}
function cookieToken(request){return (request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-ys_session=([0-9a-f]{64})(?:;|$)/)?.[1];}
async function sessionOwner(request,db){const s=cookieToken(request);if(!s)return null;
  return (await db.prepare('SELECT owner FROM member_sessions WHERE digest=? AND expires>?').bind(await digest(s),Math.floor(Date.now()/1000)).first())?.owner||null;}
function sessionCookie(value,age){return '__Host-ys_session='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;}
function signedRedirect(path,value,age=sessionTTL){return new Response(null,{status:303,headers:{...defaultHeaders,Location:path,'Set-Cookie':sessionCookie(value,age)}});}
async function startSession(db,owner,back,request){
  if(request.headers.get('Sec-Fetch-Mode')==='navigate' && !back.startsWith('/api/member-badge/connect?')){
    back='/api/member-badge/connect?continue='+encodeURIComponent(back);
  }
  const s=token(),now=Math.floor(Date.now()/1000);
  await db.batch([db.prepare('DELETE FROM member_sessions WHERE expires<=?').bind(now),
    db.prepare('INSERT INTO member_sessions(digest,owner,expires) VALUES(?,?,?)').bind(await digest(s),owner,now+sessionTTL)]);
  return signedRedirect(back,s);
}
async function throttle(db,request,email){
  const now=Math.floor(Date.now()/1000),ip=request.headers.get('CF-Connecting-IP')||'shared';
  const hit=async(key,limit)=>{
    const bucket=await digest(key);
    const out=await db.prepare('INSERT INTO login_attempts(bucket,attempts,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING attempts').bind(bucket,now+600,now,now).first();
    return out.attempts<=limit;
  };
  if(!await hit('ip:'+ip,100)||!await hit('email:'+email,15))throw new Issue('Too many attempts. Try again in ten minutes.',429);
  if(Math.random()<0.03)await db.prepare('DELETE FROM login_attempts WHERE expires<=?').bind(now).run();
}
function loginForm(p,u,back,error='',status=200){
  const join=p==='/signup/',recover=p==='/recover/',query='?returnTo='+encodeURIComponent(back),claim=join && u.searchParams.get('owner')==='1';
  const title=join?'Create your YesterSites account':recover?'Reset your password':'Member sign in';
  const pass=join||recover?'new-password':'current-password';
  return accountWindow(title,(error?'<p role="alert">'+e(error)+'</p>':'')+(back.startsWith('/account/publish/')?'<p>Your project will publish after you '+(join?'register':'sign in')+'.</p>':'')+
    '<form method="post" action="'+p+query+(claim?'&amp;owner=1':'')+'"><label>Email address<input name="email" type="email" maxlength="254" required autocomplete="username"></label>'+
    (join?'<label>Webmaster handle<input name="handle" minlength="2" maxlength="24" required autocomplete="nickname"></label>':'')+
    (recover||claim?'<label>'+(claim?'Owner activation code':'Recovery key')+'<input name="proof" required autocomplete="off" maxlength="80"></label>':'')+
    '<label>'+(recover?'New password':'Password')+'<input name="password" type="password" required maxlength="256" '+(join||recover?'minlength="15" ':'')+'autocomplete="'+pass+'"></label>'+
    (join||recover?'<small>Use at least 15 characters. A passphrase works.</small>':'')+'<button class="primary">'+(join?'Create account':recover?'Reset password':'Sign in')+'</button></form>'+
    '<p class="switch">'+(join||recover?'<a href="/signin/'+query+'">Member sign in</a>':'<a href="/signup/'+query+'">Create an account</a> · <a href="/recover/'+query+'">Use a recovery key</a> · <a href="/forgot/">Email a reset link</a>')+'</p>',status);
}
async function credentialsRoute(request,u,db,owner,back){
  const p=u.pathname,post=request.method==='POST';
  if(!post && p==='/signout/')return accountWindow('Sign out',owner?'<form method="post" action="/signout/"><button>Sign out of YesterSites</button></form><a href="/account/">Back to My Sites</a>':'<p>You are signed out.</p><a href="/signin/">Sign in</a>');
  const sync=request.headers.get('Sec-Fetch-Mode')==='navigate';
  if(!post)return owner && p!=='/recover/'?new Response(null,{status:303,headers:{Location:back,...defaultHeaders}}):loginForm(p,u,back);
  if(request.headers.get('Origin')!==u.origin)throw new Issue('Submit this form from YesterSites.',403);
  const form=new URLSearchParams(await readLimited(request,4096));
  const email=(form.get('email')||'').trim().toLowerCase(),password=form.get('password')||'';
  if(p==='/signout/'){const s=cookieToken(request);if(s)await db.prepare('DELETE FROM member_sessions WHERE digest=?').bind(await digest(s)).run();return signedRedirect(sync?'/api/member-badge/connect?to='+encodeURIComponent(badgeHome+'/'):'/signin/','',0);}
  if(p==='/account/recovery/'){
    if(!owner)throw new Issue('Sign in first.',401);
    const row=await db.prepare('SELECT email,salt,rounds,hash FROM local_accounts WHERE owner=?').bind(owner).first();
    await throttle(db,request,row.email);
    if(!equalHash(await passwordKey(password,row.salt,row.rounds),row.hash))return accountWindow('Recovery key','<p>Incorrect password.</p><a href="/account/">My account</a>',403);
    const key=token();await db.prepare('UPDATE local_accounts SET recovery=? WHERE owner=?').bind(await digest(key),owner).run();
    return accountWindow('Save your recovery key','<p>Keep this one-use key somewhere private. It can reset your password.</p><code>'+key+'</code><p><a href="/account/">My account</a></p>');
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!password||password.length>256)return loginForm(p,u,back,'Enter your email address and password.',400);
  await throttle(db,request,email);
  if(p==='/signin/'){
    const row=await db.prepare('SELECT owner,salt,rounds,hash FROM local_accounts WHERE email=?').bind(email).first();
    const test=row?await passwordKey(password,row.salt,row.rounds):(await newHash(password)).hash;
    if(!row || !equalHash(test,row.hash))return loginForm(p,u,back,'Email or password is incorrect.',401);
    return startSession(db,row.owner,back,request);
  }
  if(password.length<15)return loginForm(p,u,back,'Choose a password of at least 15 characters.',400);
  if(p==='/recover/'){
    const proof=await digest(form.get('proof')||'');
    const row=await db.prepare('SELECT owner FROM local_accounts WHERE email=? AND recovery=?').bind(email,proof).first();
    if(!row)return loginForm(p,u,back,'The email and recovery key do not match.',400);
    const {salt,hash,rounds}=await newHash(password);
    const results=await db.batch([db.prepare('UPDATE local_accounts SET hash=?,salt=?,rounds=?,recovery=NULL WHERE owner=? AND recovery=?').bind(hash,salt,rounds,row.owner,proof),
      db.prepare('DELETE FROM member_sessions WHERE owner=? AND changes()>0').bind(row.owner)]);
    if(!results[0].meta.changes)return loginForm(p,u,back,'This key has already been used.',409);
    return startSession(db,row.owner,back,request);
  }
  const handle=(form.get('handle')||'').trim().toLowerCase(),proof=form.get('proof')||'';
  const claiming=proof.length===64 && equalHash(await digest(proof),founderClaimHash);
  if(!/^[a-z0-9][a-z0-9_-]{1,23}$/.test(handle))return loginForm(p,u,back,'Choose a handle of 2–24 letters, numbers, underscores or hyphens.',400);
  if((handle==='roddy'||await digest(email)===founderEmailDigest||proof) && !claiming)return loginForm(p,u,back,'That account is reserved. Use the owner activation form or a different handle and email.',409);
  let id=crypto.randomUUID();
  if(claiming){const row=await db.prepare('SELECT owner_id FROM member_sites WHERE creator_key=? LIMIT 1').bind(await creatorKey(founder)).first();id=row?.owner_id||founder;}
  const {salt,hash,rounds}=await newHash(password);
  try{await db.batch([db.prepare('INSERT INTO local_accounts(owner,email,salt,hash,rounds) VALUES(?,?,?,?,?)').bind(id,email,salt,hash,rounds),
    db.prepare("INSERT INTO webmasters(owner,handle,joined) VALUES(?,?,datetime('now')) ON CONFLICT(owner) DO UPDATE SET handle=excluded.handle").bind(id,handle)]);}
  catch(error){if(!/unique|constraint/i.test(error.message+' '+String(error.cause)))throw error;return loginForm(p,u,back,'That email or handle is already in use.',409);}
  return startSession(db,id,back,request);
}

const founderClaimHash='__FOUNDER_ACTIVATION_SHA256__';
