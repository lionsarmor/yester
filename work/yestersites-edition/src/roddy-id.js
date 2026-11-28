// The issuer and redirect URI are fixed. Member sites never receive login tokens.
const roddyIssuer = 'https://accounts.roddy.world';
const roddyClient = 'yestersites';
const roddyCallback = 'https://yestersites-webring.jamesmweeksjr.chatgpt.site/api/roddy/callback';
const founderSubject = 'f46e7482-5e5f-49bf-be28-2685d0ec051e';

function url64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function read64(value) {
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c => c.charCodeAt(0));
}
const loginCookie = (value,age) => '__Host-roddy_login='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
async function beginRoddyLogin(u,back) {
  const state=token(), verifier=token(), nonce=token();
  const challenge=url64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const authorize=new URL('/identity/o/authorize',roddyIssuer);
  authorize.search=new URLSearchParams({client_id:roddyClient,response_type:'code',scope:'openid profile',
    redirect_uri:roddyCallback,state,nonce,code_challenge_method:'S256',code_challenge:challenge});
  const entry=u.pathname==='/signup/' ? new URL('/signup/',roddyIssuer) : authorize;
  if(entry!==authorize)entry.searchParams.set('next',authorize.pathname+authorize.search);
  const data=url64(new TextEncoder().encode(JSON.stringify({state,verifier,nonce,back})));
  return new Response(null,{status:303,headers:{Location:entry.href,'Set-Cookie':loginCookie(data,600),'Cache-Control':'no-store'}});
}
async function verifiedRoddyClaims(jwt,nonce) {
  const [header,body,sig,...extra]=String(jwt).split('.');
  if(!sig || extra.length)throw new Error('Invalid identity token');
  const decode=value=>JSON.parse(new TextDecoder().decode(read64(value)));
  const meta=decode(header), claims=decode(body), now=Date.now()/1000;
  if(meta.alg!=='RS256' || claims.iss!==roddyIssuer || claims.aud!==roddyClient ||
     claims.nonce!==nonce || !Number.isFinite(claims.exp) || claims.exp<=now ||
     !Number.isFinite(claims.iat) || claims.iat>now+60 || !uuidPattern.test(claims.sub))throw new Error('Invalid claims');
  const response=await fetch(roddyIssuer+'/.well-known/jwks.json',{redirect:'manual'});
  if(!response.ok)throw new Error('Signing keys unavailable');
  const {keys}=await response.json();
  const rsa=keys.find(k=>k.kid===meta.kid && k.kty==='RSA');
  if(!rsa)throw new Error('Unknown signer');
  const key=await crypto.subtle.importKey('jwk',rsa,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,read64(sig),new TextEncoder().encode(header+'.'+body)))throw new Error('Invalid signature');
  return claims;
}
async function finishRoddyLogin(request,u,db) {
  const cookie=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-roddy_login=([\w-]+)/);
  let stage='browser session';
  const retry=()=>accountWindow('Sign in again','<p>Sign-in stopped at '+e(stage)+'. Open a fresh sign-in window and try again.</p><a href="/signin/">Sign in with RODDY</a>',401);
  if(!cookie || !u.searchParams.get('code'))return retry();
  let flow,claims,profile;
  try {
    flow=JSON.parse(new TextDecoder().decode(read64(cookie[1])));
    if(!equalHash(flow.state,u.searchParams.get('state')||''))return retry();
    stage='authorization exchange';
    const response=await fetch(roddyIssuer+'/identity/o/api/token',{method:'POST',redirect:'manual',
      body:new URLSearchParams({grant_type:'authorization_code',code:u.searchParams.get('code'),client_id:roddyClient,
        redirect_uri:roddyCallback,code_verifier:flow.verifier})});
    if(!response.ok){stage+=' ('+response.status+')';return retry();}
    const tokens=await response.json();
    stage='identity signature';
    claims=await verifiedRoddyClaims(tokens.id_token,flow.nonce);
    stage='account profile';
    const info=await fetch(roddyIssuer+'/identity/o/api/userinfo',{redirect:'manual',headers:{Authorization:'Bearer '+tokens.access_token}});
    if(!info.ok)return retry();
    profile=await info.json();
    if(profile.sub!==claims.sub || !/^[a-z0-9][a-z0-9_-]{1,23}$/i.test(profile.preferred_username))return retry();
  } catch {return retry();}
  const oldFounder=claims.sub===founderSubject ? await db.prepare("SELECT owner FROM webmasters WHERE lower(handle)='roddy'").first():null;
  const owner=claims.sub===founderSubject ? (oldFounder?.owner||founder) : 'roddy:'+claims.sub;
  let handle=profile.preferred_username.toLowerCase();
  const occupied=await db.prepare('SELECT owner FROM webmasters WHERE lower(handle)=?').bind(handle).first();
  // A fresh registration can never inherit an older handle's publishing rights.
  if(occupied && occupied.owner!==owner)handle='member-'+claims.sub;
  await db.prepare("INSERT INTO webmasters(owner,handle,joined) VALUES(?,?,datetime('now')) ON CONFLICT(owner) DO NOTHING").bind(owner,handle).run();
  const next=new URL('/account/',u.origin);
  next.searchParams.set('returnTo',flow.back);
  const result=await startSession(db,owner,accountReturn(next),request);
  result.headers.append('Set-Cookie',loginCookie('',0));
  return result;
}
