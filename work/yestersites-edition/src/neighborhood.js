// The platform supplies verified account headers. The display name is never a claim credential.
const founder='stock:roddy';
const catalogs=new WeakMap();
async function ensureOriginals(db){
  if(!catalogs.has(db)){
    const install=(async()=>{
      const key=await creatorKey(founder);
      const sql='INSERT INTO member_sites (slug,owner_id,creator_key,title,profile,theme,byline,listed,blocks_json,links_json,snippet,keywords_json,updated_at) VALUES(?,?,?,?,?,'+"'paper','Roddy',1,?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING";
      await db.batch(originalSites.map(s=>db.prepare(sql).bind(s.slug,founder,key,s.title,s.profile,'{"stock":true}',JSON.stringify(s.links),s.excerpt,JSON.stringify(s.keywords),'2026-11-20T00:00:00Z')));
    })();
    catalogs.set(db,install);
    install.catch(()=>catalogs.delete(db));
  }
  return catalogs.get(db);
}
async function accountShelf(db,owner){
  const current=await db.prepare('SELECT creator_key FROM member_sites WHERE owner_id=? LIMIT 1').bind(owner).first();
  return current?.creator_key || creatorKey(owner);
}
function dayScore(slug,day){
  let score=2166136261;
  for(const char of slug+'|'+day){score=Math.imul(score^char.charCodeAt(0),16777619);}
  score=Math.imul(score^(score>>>16),2246822507);
  return (score^(score>>>13))>>>0;
}
async function trending(db){
  const day=new Date().toISOString().slice(0,10);
  const {results}=await db.prepare(`SELECT m.slug,m.title,m.snippet,m.profile,m.byline,coalesce(sum(v.views),0) views
    FROM member_sites m LEFT JOIN daily_visits v ON v.slug=m.slug AND v.day>=date(?,'-7 days') AND v.day<?
    WHERE m.listed=1 GROUP BY m.slug`).bind(day,day).all();
  const rows=results.map(r=>({...r,score:dayScore(r.slug,day)}));
  const rank=(a,b)=>b.score-a.score||a.slug.localeCompare(b.slug);
  const leaders=rows.filter(r=>r.views>0).sort((a,b)=>b.views-a.views||rank(a,b)).slice(0,3);
  const picks=rows.filter(r=>!leaders.includes(r)).sort(rank).slice(0,5-leaders.length);
  const response=json({day,sites:[...leaders,...picks].map(({score,...site})=>site)});
  response.headers.set('Access-Control-Allow-Origin','*');
  return response;
}
async function countVisit(db,slug){
  await db.prepare("INSERT INTO daily_visits(day,slug,views) SELECT date('now'),slug,1 FROM member_sites WHERE slug=? AND listed=1 ON CONFLICT(day,slug) DO UPDATE SET views=views+1").bind(slug).run();
}

const founderEmailDigest='__FOUNDER_EMAIL_SHA256__';
