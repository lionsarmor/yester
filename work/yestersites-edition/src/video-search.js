const videoCache=new Map();
async function videoSearch(request,u,env){
  const respond=(data,status=200)=>Response.json(data,{status,headers:{'Access-Control-Allow-Origin':'*','Cache-Control':status===200?'public, max-age=1800':'no-store'}});
  const q=(u.searchParams.get('q')||'').trim(),pageToken=u.searchParams.get('pageToken')||'';
  if(!q || q.length>100 || !/^[\w=-]{0,240}$/.test(pageToken))return respond({error:'Enter a search of 1–100 characters.'},400);
  if(!env.YOUTUBE_API_KEY)return respond({error:'YouTube catalog search is awaiting activation. You can still paste a public YouTube link.'},503);
  const cacheKey=JSON.stringify([q,pageToken]),cached=videoCache.get(cacheKey);
  if(cached && cached.until>Date.now())return respond(cached.data);
  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.search=new URLSearchParams({q,part:'snippet',type:'video',publishedBefore:'2011-01-01T00:00:00Z',videoEmbeddable:'true',videoSyndicated:'true',maxResults:'12',...(pageToken?{pageToken}:{})});
  let result;
  try{result=await fetch(url,{headers:{'X-Goog-Api-Key':env.YOUTUBE_API_KEY},signal:AbortSignal.timeout(9000)});}
  catch{return respond({error:'YouTube search timed out. Try again.'},503);}
  if(!result.ok){
    const reason=await result.json().catch(()=>null);
    const quota=['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(reason?.error?.errors?.[0]?.reason);
    return result.status===429 || quota?respond({error:'YouTube search has reached its request limit.'},429):respond({error:'YouTube search is temporarily unavailable. You can still paste a video link.'},503);
  }
  const rows=await result.json(),items=[];
  for(const r of rows.items||[]){
    const id=r.id?.videoId,published=Date.parse(r.snippet?.publishedAt),year=new Date(published).getUTCFullYear();
    if(!/^[a-zA-Z0-9_-]{11}$/.test(id||'') || !(year>=2005 && year<=2010))continue;
    items.push({id,year,title:r.snippet.title,thumbnail:'https://i.ytimg.com/vi/'+id+'/mqdefault.jpg',url:'https://www.youtube.com/watch?v='+id});
  }
  const data={items,nextPageToken:rows.nextPageToken||''};
  if(videoCache.size>=256)videoCache.delete(videoCache.keys().next().value);
  videoCache.set(cacheKey,{data,until:Date.now()+1800000});
  return respond(data);
}
