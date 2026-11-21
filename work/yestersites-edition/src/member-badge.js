// The public chrome can read a handle. Only the HttpOnly account cookie authorizes edits.
const badgeHome = 'https://yestersites.com';
const badgeEditor = 'https://retropage.yestersites.com';
function badgeDestination(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash || url.href.length > 4096) return null;
    const allowed = url.origin === badgeEditor ? /^\/(?:index\.html)?$/ :
      url.origin === badgeHome ? /^\/(?:(?:browse|crawler|retropage|desktop(?:\/(?:8bit|windows31))?)\/)?(?:index\.html)?$|^\/text\.html$/ : null;
    return allowed?.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
async function memberBadge(request, u, db, owner) {
  if (u.pathname === '/api/member-badge/status') {
    const origin = request.headers.get('Origin');
    if (request.method !== 'POST' || origin !== badgeHome) throw new Issue('Use the YesterSites account control.',403);
    const ticket = await readLimited(request,128);
    const row = /^[0-9a-f]{64}$/.test(ticket) && await db.prepare(
      'SELECT w.handle FROM member_sessions s JOIN webmasters w ON w.owner=s.owner WHERE s.badge=? AND s.expires>?'
    ).bind(await digest(ticket),Math.floor(Date.now()/1000)).first();
    return Response.json({handle:row?.handle || null},{headers:{...defaultHeaders,'Access-Control-Allow-Origin':badgeHome,'Vary':'Origin'}});
  }
  if (request.method !== 'GET') throw new Issue('Method not allowed.',405);
  const target = badgeDestination(u.searchParams.get('to'));
  const back = accountReturn(new URL('/?returnTo='+encodeURIComponent(u.searchParams.get('continue')||''),u));
  const next = target || new URL(back.startsWith('/api/member-badge/')?'/account/':back,serviceHome).href;
  let ticket = '';
  if (owner) {
    const session = cookieToken(request);
    ticket = await digest('YesterSites display only\n'+session);
    await db.prepare('UPDATE member_sessions SET badge=? WHERE digest=? AND badge IS NULL').bind(await digest(ticket),await digest(session)).run();
  }
  const callback = new URL('/account/connected/',badgeHome);
  callback.hash = new URLSearchParams({badge:ticket,next}).toString();
  const href=e(callback.href);
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>YesterSites member desk</title><meta http-equiv="refresh" content="0;url='+href+'"></head><body><a href="'+href+'">Continue to YesterSites</a></body></html>',{headers:{...defaultHeaders,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
}

async function directoryMemberNav(owner,db){
  const person=owner && await db.prepare('SELECT handle FROM webmasters WHERE owner=?').bind(owner).first();
  return '<p align="right">'+(person?'<a href="/account/">'+e(person.handle)+' · My Sites</a> | <a href="/signout/">Sign out</a>':'<a href="/signin/">Sign in</a> | <a href="/signup/">Join</a>')+'</p>';
}
