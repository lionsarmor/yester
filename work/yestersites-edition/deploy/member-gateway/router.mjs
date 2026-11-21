import {RewritingStream} from 'parse5-html-rewriting-stream';
import {Readable} from 'node:stream';
const apex='https://yestersites.com',service='https://yestersites-webring.jamesmweeksjr.chatgpt.site';
const pagesOrigin='http://127.0.0.1:8138';
const siteLabel=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reserved=new Set('www retropage mail smtp pop imap ftp api admin accounts studio assets ns1 ns2'.split(' '));
export function tenant(host){
  const match=/^([a-z0-9-]{1,40})\.yestersites\.com$/.exec(host);
  return match && siteLabel.test(match[1]) && !reserved.has(match[1])?match[1]:null;
}
function external(value,base){
  let url;try{url=new URL(value,base);}catch{return value;}
  if(![apex,service].includes(url.origin))return value;
  const member=/^\/members\/([a-z0-9-]+)(?:\/(.*))?$/.exec(url.pathname);
  if(member && tenant(member[1]+'.yestersites.com'))return 'https://'+member[1]+'.yestersites.com/'+(member[2]==='index.html'?'':member[2]||'')+url.search+url.hash;
  if(url.origin===service && value.startsWith('/') && !value.startsWith('//') && !/^\/(?:members|api|creators|account|signup|signin|studio|desktop)(?:\/|$)/.test(url.pathname)){
    const own=/^\/members\/([a-z0-9-]+)\//.exec(new URL(base).pathname);
    if(own)return 'https://'+own[1]+'.yestersites.com'+url.pathname+url.search+url.hash;
  }
  return url.href;
}
function rewrite(body,base,classicOrigin){
  let inScript=false;
  const html=new RewritingStream();
  if(classicOrigin){
    html.on('text',(_,raw)=>{if(!inScript)html.emitRaw(raw);});
    html.on('endTag',(tag,raw)=>{
      if(tag.tagName==='script'){inScript=false;return;}
      if(!inScript)html.emitRaw(raw);
    });
  }
  html.on('startTag',(tag,raw)=>{
    if(classicOrigin && tag.tagName==='script'){inScript=true;return;}
    if(inScript)return;
    let changed=false;
    for(const a of tag.attrs){
      if(!['href','src','action','background','poster'].includes(a.name)||!a.value||a.value.startsWith('#'))continue;
      let next=external(a.value,base);
      if(classicOrigin && next.startsWith(classicOrigin+'/')){
        const url=new URL(next);
        const path=url.pathname.replace(/^\/page-([0-9a-f]{32})-classic\.html$/,'/classic/$1/INDEX.HTM');
        next=path+url.search+url.hash;
      }
      if(next!==a.value){changed=true;a.value=next;}
    }
    if(changed)html.emitStartTag(tag);else html.emitRaw(raw);
  });
  const input=Readable.fromWeb(body).setEncoding('utf8');input.on('error',err=>html.destroy(err));html.on('close',()=>input.destroy());input.pipe(html);
  return Readable.toWeb(html,{strategy:{highWaterMark:65536,size:chunk=>Buffer.byteLength(chunk)}}).pipeThrough(new TextEncoderStream());
}
const fail=(status,message)=>new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
export async function route(req,fetcher=fetch){
  const u=new URL(req.url),slug=tenant(u.hostname);
  if(u.hostname==='127.0.0.1' && u.pathname==='/ask' && req.method==='GET'){
    const host=u.searchParams.get('domain')||'',key=tenant(host);
    if(!key)return fail(403,'Reserved or unknown host');
    const check=await fetcher(service+'/api/member-host?slug='+key,{redirect:'manual',signal:AbortSignal.timeout(4000)});
    return new Response(null,{status:check.status===204?204:403});
  }
  if(!slug)return fail(404,'No member site at this address');
  if(u.pathname==='/.well-known/yestersites-member')return new Response(null,{status:204,headers:{'X-YesterSites-Member':slug,'Cache-Control':'no-store'}});
  const read=['GET','HEAD'].includes(req.method),memberForm=['/guestbook/','/bbs/'].includes(u.pathname)&&req.method==='POST';
  if(!read && !memberForm)return fail(405,'Method not allowed');
  if(memberForm && req.headers.get('origin')!=='https://'+u.hostname)return fail(403,'Use this site’s form');
  const legacy=/^\/members\/([a-z0-9-]+)(?:\/|$)/.exec(u.pathname);
  if(legacy && tenant(legacy[1]+'.yestersites.com'))return Response.redirect(external(u.pathname+u.search,apex),308);
  if(u.pathname.startsWith('/assets/')||u.pathname==='/favicon.ico')return Response.redirect(apex+u.pathname+u.search,302);
  const base='/members/'+slug+'/';
  const headers=new Headers();
  for(const key of ['range','if-range','accept'])if(req.headers.has(key))headers.set(key,req.headers.get(key));
  if(memberForm){headers.set('origin',service);headers.set('content-type',req.headers.get('content-type')||'');}
  const init={method:req.method,headers,redirect:'manual',signal:req.signal};
  if(memberForm){init.body=req.body;init.duplex='half';}
  const incoming=u.pathname.replace(/^\/classic\/([0-9a-f]{32})\/INDEX\.HTM$/i, (_,id)=>'/page-'+id.toLowerCase()+'-classic.html');
  const classic=/(?:^\/|[-/])(?:classic|text)\.html$/i.test(incoming) && u.searchParams.get('surfer')!=='1';
  let upstream=service+base+incoming.slice(1)+u.search;
  let response=await fetcher(upstream,init);
  const location=response.headers.get('location');
  if(read && response.status===302 && location===apex+base+u.pathname.slice(1)+u.search){
    await response.body?.cancel();
    upstream=location;
    const staticFile=new URL(location);
    response=await fetcher(pagesOrigin+staticFile.pathname+staticFile.search,init);
  }
  const out=new Headers(response.headers);
  out.delete('set-cookie');out.delete('content-encoding');out.delete('content-length');out.delete('transfer-encoding');out.delete('connection');
  if(out.has('location'))out.set('location',external(out.get('location'),upstream));
  const isHTML=out.get('content-type')?.includes('text/html');
  if(isHTML){out.delete('etag');out.set('content-location','https://'+u.hostname+u.pathname+u.search);}
  return new Response(isHTML&&response.body?rewrite(response.body,upstream,classic?u.origin:null):response.body,{status:response.status,headers:out});
}
