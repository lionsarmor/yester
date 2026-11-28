const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const profiles = new Set(["text", "classic", "millennium"]);
const themes = {
  paper: {bg:"#fffbe8", fg:"#262134", link:"#412286", accent:"#e4d7b0"},
  night: {bg:"#100e22", fg:"#fff6d8", link:"#9aedef", accent:"#38314c"},
  mint: {bg:"#e4f2dc", fg:"#153826", link:"#66398e", accent:"#b9d5ae"}
};
const maxJSON = 512 * 1024;
const imageHeader = /^data:image\/(gif|jpeg);base64,/;
const defaultHeaders = {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const publicHtmlHeaders = {
  ...defaultHeaders, "Content-Type":"text/html; charset=utf-8",
  "Content-Security-Policy":"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy":"strict-origin-when-cross-origin"
};

function json(value, status = 200) {
  return Response.json(value, {status, headers:defaultHeaders});
}
function html(value, status = 200) {
  return new Response(value, {status, headers:publicHtmlHeaders});
}
function e(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
}
class Issue extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function requiredText(value, label, max, empty = false) {
  if (typeof value !== "string") throw new Issue(label + " is required.");
  const clean = value.trim();
  if ((!empty && !clean) || clean.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(clean)) {
    throw new Issue(label + " must contain " + (empty ? "0" : "1") + "–" + max + " valid characters.");
  }
  return clean;
}
function validLink(raw, origin) {
  const value = requiredText(raw, "Link address", 2048);
  if (/[\\\s]/.test(value) || !(value.startsWith("/") && !value.startsWith("//") || /^https?:\/\//i.test(value))) {
    throw new Issue("Use an http://, https://, or /site-relative link.");
  }
  let target;
  try { target = new URL(value, origin); } catch { throw new Issue("Invalid link address."); }
  if (target.username || target.password || !["http:","https:"].includes(target.protocol)) throw new Issue("Invalid link address.");
  return value.startsWith("/") ? target.pathname + target.search + target.hash : target.href;
}
function imageData(value) {
  const prefix = typeof value === "string" && value.match(imageHeader);
  if (!prefix) throw new Issue("Upload a GIF or JPEG image.");
  const encoded = value.slice(prefix[0].length);
  if (encoded.length > 131072 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Issue("Images must fit in 96 KiB and contain valid base64.");
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  let width=0, height=0;
  if (prefix[1] === "gif" && bytes.length >= 14 && /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0,6))) && bytes.at(-1) === 0x3b) {
    width=bytes[6]+256*bytes[7]; height=bytes[8]+256*bytes[9];
  } else if (prefix[1] === "jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    for (let at=2; at+8<bytes.length && bytes[at]===0xff;) {
      while (bytes[at]===0xff) at++;
      const marker=bytes[at++], size=(bytes[at]<<8)+bytes[at+1];
      if (size<2 || at+size>bytes.length || marker===0xda) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && size>=8) {
        height=(bytes[at+3]<<8)+bytes[at+4]; width=(bytes[at+5]<<8)+bytes[at+6]; break;
      }
      at+=size;
    }
  }
  if (!width || !height || width>4096 || height>4096 || width*height>6000000) throw new Issue("Use a valid GIF or JPEG within 4,096 pixels per side and 6 megapixels.");
  return {bytes,mime:"image/"+prefix[1]};
}
function preparePage(input, origin) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Issue("Expected a page document.");
  const slug=requiredText(input.slug,"Site address",40);
  if (reservedHosts.has(slug))throw new Issue("That name is reserved for a YesterSites service.",409);
  if (!slugPattern.test(slug)) throw new Issue("The address can contain lowercase letters, digits and interior hyphens.");
  const title=requiredText(input.title,"Page title",80);
  const byline=requiredText(input.byline ?? "","Webmaster name",48,true);
  if (!profiles.has(input.profile) || !Object.hasOwn(themes,input.theme) || typeof input.listed!=="boolean") throw new Issue("Choose a supported profile, theme and directory setting.");
  if (!Array.isArray(input.blocks) || !input.blocks.length || input.blocks.length>64) throw new Issue("Add 1–64 blocks.");
  let imageCount=0;
  const blocks=input.blocks.map((b)=>{
    if (!b || typeof b!=="object") throw new Issue("Invalid content block.");
    if (b.type==="rule") return {type:"rule"};
    const text=requiredText(b.text, b.type==="image" ? "Image description" : "Block text", b.type==="paragraph"?4000:300);
    if (b.type==="heading" || b.type==="paragraph") return {type:b.type,text};
    if (b.type==="link") return {type:"link",text,url:validLink(b.url,origin)};
    if (b.type==="image") {
      if (++imageCount>3) throw new Issue("Each page supports three images.");
      imageData(b.url);
      return {type:"image",text,url:b.url};
    }
    throw new Issue("Unsupported block type.");
  });
  const links=new Set();
  for (const b of blocks) {
    if (b.type!=="link") continue;
    const target=new URL(b.url,origin);
    const match=target.pathname.match(/^\/members\/([a-z0-9-]+)(?:\/|$)/);
    if (match && target.origin===origin && match[1]!==slug) links.add(match[1]);
  }
  const snippet=(blocks.find(b=>b.type==="paragraph")?.text || "").slice(0,180);
  const keywords=[...new Set(blocks.filter(b=>b.type==="heading").flatMap(b=>b.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []))].slice(0,24);
  return {slug,title,byline,profile:input.profile,theme:input.theme,listed:input.listed,blocks,links:[...links],snippet,keywords};
}
const desktopFonts = {
  Times:"Times New Roman,Times,serif",
  "Times New Roman":"Times New Roman,Times,serif",
  Georgia:"Georgia,serif", Helvetica:"Helvetica,Arial,sans-serif",
  Arial:"Arial,Helvetica,sans-serif", Verdana:"Verdana,Arial,sans-serif",
  Courier:"Courier New,Courier,monospace", "Courier New":"Courier New,Courier,monospace",
  "Trebuchet MS":"Trebuchet MS,Arial,sans-serif", Tahoma:"Tahoma,Arial,sans-serif"
};
const desktopKinds = new Set(["text", "image", "rule", "box", "link"]);

function size(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Issue(name + " must be an integer from " + min + " to " + max + ".");
  }
  return value;
}

function paint(value, name, fallback, transparent = false) {
  if (value === undefined || value === "") return fallback;
  if ((transparent && value === "transparent") ||
      (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value))) return value;
  throw new Issue(name + " needs a six-digit hex color.");
}

function desktopImage(value) {
  if (typeof value !== "string" || !value.startsWith("data:image/png;base64,")) return imageData(value);
  const encoded = value.slice("data:image/png;base64,".length);
  if (encoded.length > 131072 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Issue("Use a valid PNG of 96 KiB or less.");
  }
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const signature = [137,80,78,71,13,10,26,10];
  if (bytes.length < 45 || !signature.every((v,i) => bytes[i] === v) ||
      String.fromCharCode(...bytes.subarray(12,16)) !== "IHDR" ||
      String.fromCharCode(...bytes.subarray(-8,-4)) !== "IEND") throw new Issue("Invalid PNG.");
  const data = new DataView(bytes.buffer), w = data.getUint32(16), h = data.getUint32(20);
  if (!w || !h || w > 4096 || h > 4096 || w*h > 6000000) throw new Issue("Image dimensions exceed the page limit.");
  return {bytes, mime:"image/png"};
}

function prepareLayout(input, origin, internal) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Issue("Expected a desktop project.");
  const slug = requiredText(input.slug, "Site address", 40);
  if (reservedHosts.has(slug))throw new Issue("That name is reserved for a YesterSites service.",409);
  if (!slugPattern.test(slug)) throw new Issue("Choose an address with lowercase letters, digits or interior hyphens.");
  const title = requiredText(input.title, "Page title", 80);
  const byline = requiredText(input.byline ?? "", "Webmaster name", 48, true);
  if (!profiles.has(input.profile) || typeof input.listed !== "boolean") throw new Issue("Choose a page profile and a directory setting.");
  const width = size(input.width, "Page width", 160, 2048);
  const height = size(input.height, "Page height", 120, 8192);
  const background = paint(input.background, "Page background", "#ffffff");
  if (!Array.isArray(input.items) || (!internal && !input.items.length) || input.items.length > 64) throw new Issue("A desktop page needs 1–64 objects.");
  const ids = new Set(), links = new Set();
  let imageCount = 0;
  const items = input.items.map(raw => {
    if (!raw || typeof raw !== "object" || !desktopKinds.has(raw.kind)) throw new Issue("Unsupported canvas object.");
    const id = requiredText(String(raw.id ?? ""), "Object ID", 80);
    if (ids.has(id)) throw new Issue("Each object must have a unique ID.");
    ids.add(id);
    const kind = raw.kind, x = size(raw.x, "Object X", 0, width - 1), y = size(raw.y, "Object Y", 0, height - 1);
    const w = size(raw.w, "Object width", 1, width - x), h = size(raw.h, "Object height", 1, height - y);
    const item = {id, kind, x, y, w, h,
      color:paint(raw.color, "Text color", "#14121a"),
      fill:paint(raw.fill, "Object fill", "transparent", true),
      font_size:size(raw.font_size ?? 16, "Font size", 6, 160),
      font_family:Object.hasOwn(desktopFonts,raw.font_family) ? raw.font_family : "Times",
      bold:raw.bold === true, italic:raw.italic === true,
      align:["left","center","right"].includes(raw.align) ? raw.align : "left"};
    if (kind === "image" || kind === "text" || kind === "link" || kind === "box") {
      item.text = requiredText(raw.text ?? "", kind === "image" ? "Image description" : "Object text", 8000, true);
    }
    if (kind === "image") {
      if (!internal && ++imageCount > 3) throw new Issue("A published page can contain up to three images.");
      desktopImage(raw.src);
      item.src = raw.src;
      if(internal && raw.classic_src){if(desktopImage(raw.classic_src).mime!=="image/gif")throw new Issue("Classic alternate must be a GIF.");item.classic_src=raw.classic_src;}
    }
    if (raw.href || (kind === "link" && !(internal && raw.widget==="webring"))) {
      item.href = internal && typeof raw.href==="string" && raw.href.startsWith("page:") && internal.has(raw.href.slice(5)) ? raw.href : validLink(raw.href, origin);
      const target = new URL(item.href,origin);
      const match = target.pathname.match(/^\/members\/([a-z0-9-]+)(?:\/|$)/);
      if (target.origin === origin && match && match[1] !== slug) links.add(match[1]);
    }
    if(internal && raw.text!==undefined){
      if(typeof raw.text!=="string" || raw.text.length>8000)throw new Issue("Invalid object text.");
      item.text=raw.text;
    }
    if (internal && typeof raw.widget==="string" && /^[a-z-]{1,24}$/.test(raw.widget)) item.widget=raw.widget;
    if(RetroCraft.hasFallback(raw)){
      try{Object.assign(item,RetroCraft.fallbackFields(raw));}catch(error){throw new Issue(error.message);}
    }
    if(RetroCraft.isCraft(item)){
      try{Object.assign(item,RetroCraft.fields(raw));}catch(error){throw new Issue(error.message);}
      item.href='';
    }
    if(RetroMedia.isFrame(item)){
      try{
        item.href=RetroMedia.frameURL(item.href);
        if(item.widget==="split-frame"){
          item.otherHref=RetroMedia.frameURL(raw.otherHref);
          item.otherLabel=requiredText(raw.otherLabel,"Second menu label",120);
        }
      }catch(error){throw new Issue(error.message);}
    }
    if (RetroMedia.isPlayer(item)){
      if(Object.hasOwn(item.widget==="video-player"?RetroMedia.movieStyles:RetroMedia.skins,raw.playerSkin))item.playerSkin=raw.playerSkin;
      if(Object.hasOwn(RetroMedia.voices,raw.audioMode))item.audioMode=raw.audioMode;
      if(raw.secondTitle && item.widget==='audio-player')item.secondTitle=requiredText(raw.secondTitle,'Second label',120);
      if(raw.secondSrc && item.widget==='audio-player'){try{item.secondSrc=RetroMedia.source(raw.secondSrc,item.widget).url;}catch(error){throw new Issue(error.message);}}
      if(raw.alternateSrc){try{item.alternateSrc=RetroMedia.source(raw.alternateSrc,item.widget).url;}catch(error){throw new Issue(error.message);}}
      item.autoplay=raw.autoplay===true;item.loop=raw.loop===true;}
    if (item.widget==="webring" && ["previous","directory","next"].includes(raw.ringRole))item.ringRole=raw.ringRole;
    return item;
  });
  const words = readingOrder(items).map(entry => entry.item.text || "").filter(Boolean);
  const keywords = [...new Set(words.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].slice(0,64);
  return {slug,title,byline,profile:input.profile,theme:"paper",listed:input.listed,links:[...links],
    snippet:words.join(" ").slice(0,180),keywords,blocks:{width,height,background,items}};
}

function readingOrder(items) {
  return items.map((item,index) => ({item,index})).sort((a,b) =>
    a.item.y - b.item.y || a.item.x - b.item.x || a.index - b.index);
}

function layoutPage(row, layout, forceText) {
  const plain = forceText || row.profile === "text";
  const home = memberUrl(row.slug);
  const markup = readingOrder(layout.items).map(({item,index}) => {
    const text = e(item.text || "").replace(/\r?\n/g, "<br>");
    let content = text;
    if (item.kind === "image") {
      content = plain ? "[Image: " + (text || "illustration") + "]" :
        '<img width="'+item.w+'" height="'+item.h+'" src="'+home+'images/'+index+'" alt="'+e(item.text || "")+'">';
    }
    if (item.href) content = '<a href="'+e(item.href)+'" rel="ugc">'+(content || e(item.href))+'</a>';
    if (plain) {
      if (item.kind === "rule") return "<hr>";
      return content ? "<p>"+content+"</p>" : "";
    }
    const fill = item.kind === "rule" ? item.color : item.fill;
    const style = 'position:absolute;box-sizing:border-box;overflow:hidden;left:'+item.x+'px;top:'+item.y+'px;width:'+item.w+
      'px;height:'+item.h+'px;z-index:'+(index+1)+';background:'+fill+';color:'+item.color+
      ';text-align:'+item.align+';font-size:'+item.font_size+'px;font-weight:'+(item.bold?"bold":"normal")+
      ';font-style:'+(item.italic?"italic":"normal")+';font-family:'+desktopFonts[item.font_family]+
      (item.kind==="box"?';border:1px solid '+item.color:'');
    return '<div style="'+style+'">'+content+'</div>';
  }).join("\n");
  const name = e(row.byline || row.slug);
  const author = row.listed ? '<a href="'+shelfUrl(row.creator_key)+'">'+name+'</a>' : name;
  const footer = '<hr><p>By '+author+' · <a href="'+home+(forceText?'':'text.html')+'">'+
    (forceText?'Designed edition':'Text edition')+'</a> · <a href="/members/">Member directory</a></p>';
  if (plain) return document(row.title,'<h1>'+e(row.title)+'</h1>'+markup+footer);
  const canvas = '<div style="position:relative;overflow:hidden;margin:0 auto;width:'+layout.width+'px;height:'+
    layout.height+'px;background:'+layout.background+'">'+markup+'</div>';
  return document(row.title,canvas+'<div class="credits">'+footer+'</div>',
    'body{margin:0;font:16px Arial,Helvetica,sans-serif}img{border:0;display:block}a{color:inherit;text-decoration:underline}.credits{background:#fff;color:#242035;font:14px Arial,sans-serif;padding:1px 1em}',
    'bgcolor="'+layout.background+'"');
}

async function readJSON(request, limit=maxJSON) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json") throw new Issue("Send the page as JSON.",415);
  try {return JSON.parse(await readLimited(request,limit));} catch(error){if(error instanceof Issue)throw error;throw new Issue("Invalid JSON.");}
}
async function readLimited(request,limit) {
  if (Number(request.headers.get("content-length"))>limit) throw new Issue("Submission exceeds the size limit.",413);
  const reader=request.body?.getReader();
  if (!reader) throw new Issue("Missing page document.");
  let size=0;
  const chunks=[];
  for (;;) {
    const {done,value}=await reader.read();
    if (done) break;
    size+=value.length;
    if (size>limit) { await reader.cancel(); throw new Issue("Submission exceeds the size limit.",413); }
    chunks.push(value);
  }
  return new Blob(chunks).text();
}
function safeReturnTo(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/studio/";
  const t=new URL(value,"https://site.invalid");
  if (t.origin!=="https://site.invalid" || ["/signin-with-chatgpt","/signout-with-chatgpt","/callback","/api/login"].includes(t.pathname)) return "/studio/";
  return t.pathname+t.search+t.hash;
}
const reservedHosts=new Set('www android retropage mail smtp pop imap ftp api admin accounts studio assets ns1 ns2'.split(' '));
const assignedUrl=slug=>'https://'+slug+'.yestersites.com/';
let memberDNSReady=false, memberProbe, probeAgain=0;
async function checkMemberDNS(){
  if(Date.now()<probeAgain)return;
  if(!memberProbe)memberProbe=Promise.all(['signal','orbit'].map(async slug=>{
    const r=await fetch(assignedUrl(slug)+'.well-known/yestersites-member',{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(3500)});
    return r.status===204 && r.headers.get('X-YesterSites-Member')===slug;
  })).then(results=>{memberDNSReady=results.every(Boolean);}).catch(()=>{}).finally(()=>{probeAgain=Date.now()+120000;memberProbe=null;});
  await memberProbe;
}
function publicMemberUrl(slug){return memberDNSReady?assignedUrl(slug):memberUrl(slug);}
function memberUrl(slug) { return "/members/"+slug+"/"; }
async function creatorKey(owner) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("YesterSites public shelf v1\0"+owner));
  return Array.from(new Uint8Array(bytes).subarray(0,16), b=>b.toString(16).padStart(2,"0")).join("");
}
function shelfUrl(key) { return "/creators/"+key+"/"; }
function publicFields(row) {
  return {slug:row.slug,title:row.title,profile:row.profile,byline:row.byline,creator:row.byline || row.slug,
    listed:Boolean(row.listed),creatorUrl:row.listed?shelfUrl(row.creator_key):null,url:publicMemberUrl(row.slug),canonicalUrl:assignedUrl(row.slug),updatedAt:row.updated_at};
}
// Older revisions predate capability tags. Published page bodies are JSON.stringify
// output, so literal text inside user strings cannot match this unescaped property.
const cartridgeExpression=`CASE WHEN instr(m.keywords_json,'"cap:cartridge"') THEN 1
  WHEN instr(m.keywords_json,'"cap:none"') THEN 0
  ELSE EXISTS(SELECT 1 FROM revision_pages rp
    WHERE rp.rev=json_extract(m.blocks_json,'$.release') AND instr(rp.body,'"widget":"game-cartridge"')) END`;
async function playableDirectory(db,cursor){
  if(cursor && (cursor.length>40 || !slugPattern.test(cursor)))throw new Issue("Invalid directory cursor.");
  const {results}=await db.prepare(`SELECT slug,title,snippet FROM member_sites m
    WHERE listed=1 AND slug>? AND ${cartridgeExpression} ORDER BY slug LIMIT 51`).bind(cursor||'').all();
  const sites=results.slice(0,50).map(row=>({...row,capabilities:['playable','touch','gamepad']}));
  return Response.json({sites,nextCursor:results.length>50?sites.at(-1).slug:null},
    {headers:{...defaultHeaders,'Access-Control-Allow-Origin':'*'}});
}
async function directory(db,cursor) {
  if (cursor && (cursor.length>40 || !slugPattern.test(cursor))) throw new Issue("Invalid directory cursor.");
  const {results}=await db.prepare(`SELECT m.slug,m.creator_key,m.title,m.profile,m.byline,m.listed,m.updated_at,m.snippet,m.keywords_json,
    (SELECT json_extract(r.metadata,'$.updatePath') FROM site_revisions r WHERE r.id=json_extract(m.blocks_json,'$.release') AND r.slug=m.slug) AS updatePath,
    ${cartridgeExpression} AS cartridge,
    (SELECT json_group_array(t.slug) FROM json_each(m.links_json) l JOIN member_sites t ON t.slug=l.value AND t.listed=1) AS targets
    FROM member_sites m WHERE m.listed=1 AND m.slug>? ORDER BY m.slug LIMIT 51`).bind(cursor || "").all();
  const sites=results.slice(0,50).map(row=>({...publicFields(row),updateUrl:row.updatePath?assignedUrl(row.slug)+row.updatePath:null,capabilities:row.cartridge?['playable','touch','gamepad']:[],snippet:row.snippet,...RetroTopics.unpack(JSON.parse(row.keywords_json)),keywords:JSON.parse(row.keywords_json).filter(s=>!s.startsWith('cap:')&&!s.startsWith('tag:')&&!s.startsWith('category:')),links:JSON.parse(row.targets || "[]").map(publicMemberUrl)}));
  return {sites,nextCursor:results.length>50?sites.at(-1).slug:null};
}
function renderBlock(b, index, page, textOnly) {
  const label=e(b.text || "");
  switch(b.type) {
    case "heading":return "<h2>"+label+"</h2>";
    case "paragraph":return "<p>"+label.replace(/\r?\n/g,"<br>")+"</p>";
    case "link":return '<p><a rel="ugc" href="'+e(b.url)+'">'+label+'</a></p>';
    case "rule": return "<hr>";
    case "image":return textOnly?"<p>[Image: "+label+"]</p>":'<p><img style="max-width:100%;height:auto" src="'+memberUrl(page.slug)+'images/'+index+'" alt="'+label+'"></p>';
    default:return "";
  }
}
function document(title, body, css="", attrs="") {
  return '<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(title)+'</title>'+(css?'<style>'+css+'</style>':'')+'</head><body '+attrs+'>'+body+'</body></html>';
}
function renderSite(row,forceText) {
  const stored=JSON.parse(row.blocks_json);
  if (!Array.isArray(stored)) return layoutPage(row,stored,forceText);
  const plain=forceText || row.profile==="text", colors=themes[row.theme];
  const body=stored.map((b,i)=>renderBlock(b,i,row,plain)).join("\n");
  const home=memberUrl(row.slug), dir='<a href="/members/">Member directory</a>';
  const name=e(row.byline || row.slug);
  const credits='<p>By '+(row.listed?'<a href="'+shelfUrl(row.creator_key)+'">'+name+'</a>':name)+'</p>';
  const footer='<hr><p>'+dir+' &nbsp;|&nbsp; '+(forceText?'<a href="'+home+'">Home</a>':'<a href="'+home+'text.html">Text edition</a>')+'</p>';
  const header="<h1>"+e(row.title)+"</h1>"+credits;
  if (plain) return document(row.title,header+"<hr>"+body+footer);
  const attrs='bgcolor="'+colors.bg+'" text="'+colors.fg+'" link="'+colors.link+'" vlink="'+colors.link+'"';
  const common='*{box-sizing:border-box}body{background:'+colors.bg+';color:'+colors.fg+';margin:1em auto;padding:0 1em;max-width:48em;overflow-wrap:anywhere}a{color:'+colors.link+'}img{max-width:100%;height:auto}';
  if (row.profile==="classic") {
    const css=common+'h1{text-align:center;font-family:Georgia,serif}table{margin:1em auto}';
    const mast='<table width="100%" border="3" cellpadding="8" cellspacing="2"><tr><td align="center" bgcolor="'+colors.accent+'">'+header+'</td></tr></table>';
    return document(row.title,mast+body+footer,css,attrs);
  }
  const css=common+'body{font:1rem/1.5 Verdana,Arial,sans-serif}.window{border:3px outset '+colors.accent+'}.bar{background:'+colors.accent+';border-bottom:2px groove '+colors.accent+';padding:12px 18px}.bar h1,.bar p{margin:0}.content{padding:3px 18px}.bar h1{font-family:Trebuchet MS,Arial,sans-serif}';
  return document(row.title,'<div class="window"><div class="bar">'+header+'</div><div class="content">'+body+footer+'</div></div>',css,attrs);
}
const saveSQL=`INSERT INTO member_sites (slug,owner_id,creator_key,title,profile,theme,byline,listed,blocks_json,links_json,snippet,keywords_json,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, profile=excluded.profile,theme=excluded.theme,
    byline=excluded.byline,listed=excluded.listed,blocks_json=excluded.blocks_json,links_json=excluded.links_json,snippet=excluded.snippet,
    keywords_json=excluded.keywords_json,updated_at=excluded.updated_at WHERE member_sites.owner_id=excluded.owner_id AND json_type(member_sites.blocks_json)=json_type(excluded.blocks_json)`;
async function route(request,env) {
  const u=new URL(request.url), p=u.pathname, db=env.DB;
  const reading=request.method==="GET" || request.method==="HEAD";
  if(reading && p==='/api/directory' && u.searchParams.get('cap')==='playable'){
    return playableDirectory(db,u.searchParams.get('cursor'));
  }
  const owner=await sessionOwner(request,db);
  if(p==='/api/member-badge/me' && reading){
    const profile=owner?await db.prepare('SELECT handle FROM webmasters WHERE owner=?').bind(owner).first():null;
    return json({handle:profile?.handle||null});
  }
  if(p==='/api/member-badge/status' || p==='/api/member-badge/connect')return memberBadge(request,u,db,owner);
  await ensureOriginals(db);
  if(p==='/account/profile/')return editProfile(request,u,db,owner);
  if(p==='/forgot/' || p==='/reset/')return emailRecovery(request,u,env);
  if(p==='/api/editor/open')return redeemEditor(request,db);
  if(p==='/api/video-search' && reading)return videoSearch(request,u,env);
  if(p==='/api/member-host' && reading){
    const key=u.searchParams.get('slug')||'';
    const found=key.length<=40 && slugPattern.test(key) && !reservedHosts.has(key) && await db.prepare('SELECT 1 FROM member_sites WHERE slug=?').bind(key).first();
    return new Response(null,{status:found?204:404,headers:defaultHeaders});
  }
  if(u.hostname==='yestersites-webring.jamesmweeksjr.chatgpt.site' && /^(?:\/api\/|\/account\/|\/creators\/|\/members\/?$)/.test(p))await checkMemberDNS();
  if(p==='/api/member-hosting' && reading)return Response.json({subdomains:memberDNSReady},{headers:{...defaultHeaders,'Access-Control-Allow-Origin':'*'}});
  if(["/api/address","/api/editor/handoff","/api/editor/publish","/recover/","/signout/","/account/recovery/","/signin/","/signup/","/account/","/account/publish/"].includes(p))return accountRoute(request,u,db,owner);
  const desk=p.match(/^\/account\/sites\/([a-z0-9-]{1,40})\/(edit|project|backup|history|restore|original)$/);
  if(desk)return mySitesAction(request,u,db,owner,desk[1],desk[2]);
  if(p==="/api/trending" && reading)return trending(db);
  if(p==="/creators/roddy/" && reading){
    return new Response(null,{status:302,headers:{Location:shelfUrl(await creatorKey(founder))}});
  }
  const edition=p.match(/^\/api\/originals\/([a-z0-9-]+)$/);
  if(edition && (reading || request.method==="POST")){
    const row=await db.prepare("SELECT json_extract(blocks_json,'$.stock') stock FROM member_sites WHERE slug=?").bind(edition[1]).first();
    if(request.method==="POST" && row?.stock && ["https://yestersites.com",assignedUrl(edition[1]).slice(0,-1)].includes(request.headers.get("Origin")))await countVisit(db,edition[1]);
    return Response.json({original:row?.stock===1,subdomains:memberDNSReady},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}});
  }
  const revisions=p.match(/^\/api\/site\/([a-z0-9-]{1,40})\/(revisions|rollback)$/);
  if(revisions)return revisionActions(request,u,db,owner,revisions[1],revisions[2]);
  const browse=p.match(/^\/api\/discover\/(next|previous|random|newest)$/);
  if(browse&&reading)return discover(db,browse[1],u.searchParams.get("from"));
  const published=p.match(/^\/members\/([a-z0-9-]{1,40})(?:\/(.*))?$/);
  if(published){
    const [,slug,path='']=published;
    const standby=u.searchParams.get('yester-standby')==='1';
    const seen=standby && u.searchParams.get('surfer')==='seen';
    if(request.method==='GET' && (!standby || seen) && (!path || path==='index.html'))await countVisit(db,slug);
    if(seen){
      if(request.method==='GET' && /^(?:|(?:index|classic|phone|modern|text|page-[a-f0-9]{32}(?:-(?:classic|phone|modern|text))?)\.html)$/.test(path)){
        await db.prepare("INSERT INTO site_counters(slug,views) SELECT slug,1 FROM member_sites WHERE slug=? AND json_extract(blocks_json,'$.counter')=1 ON CONFLICT(slug) DO UPDATE SET views=views+1").bind(slug).run();
      }
      return new Response(null,{status:204,headers:defaultHeaders});
    }
    const response=await memberRelease(request,u,db,slug,path);
    if(response)return response;
  }
  if (p==="/api/login" && reading) {
    const back=safeReturnTo(u.searchParams.get("returnTo"));
    return new Response(null,{status:302,headers:{...defaultHeaders,Location:owner?back:"/signin/?returnTo="+encodeURIComponent(back)}});
  }
  if (p==="/api/me" && reading) {
    if (!owner) return json({authenticated:false,sites:[]});
    const {results}=await db.prepare("SELECT slug,creator_key,title,profile,byline,listed,updated_at,json_type(blocks_json)='array' studio_editable FROM member_sites WHERE owner_id=? ORDER BY updated_at DESC,slug").bind(owner).all();
    return json({authenticated:true,sites:results.map(r=>({...publicFields(r),studioEditable:!!r.studio_editable}))});
  }
  if ((p==="/api/publish" || p==="/api/desktop/publish") && request.method==="POST") {
    if (!owner) throw new Issue("Sign in to publish or update your page.",401);
    const origin=request.headers.get("Origin");
    if (origin && origin!==u.origin) throw new Issue("Publish from this site’s editor.",403);
    if(p==="/api/desktop/publish")return publishRelease(await readJSON(request,releaseLimit),u.origin,owner,db);
    const prepare=preparePage;
    const page=prepare(await readJSON(request),u.origin);
    const {meta}=await db.prepare(saveSQL).bind(page.slug,owner,await accountShelf(db,owner),page.title,page.profile,page.theme,page.byline,Number(page.listed),JSON.stringify(page.blocks),JSON.stringify(page.links),page.snippet,JSON.stringify(page.keywords),new Date().toISOString()).run();
    if (!meta.changes) throw new Issue("That address is taken or belongs to a different editor. Choose a different address.",409);
    return json({slug:page.slug,url:publicMemberUrl(page.slug),canonicalUrl:assignedUrl(page.slug)});
  }
  const edit=p.match(/^\/api\/site\/([a-z0-9-]{1,40})\/edit$/);
  if (edit && reading) {
    if (!owner) throw new Issue("Sign in to edit your page.",401);
    const row=await db.prepare("SELECT * FROM member_sites WHERE slug=? AND owner_id=?").bind(edit[1],owner).first();
    if (!row) throw new Issue("No editable site at that address.",404);
    const blocks=JSON.parse(row.blocks_json);
    if (!Array.isArray(blocks)) throw new Issue("Open the original .yst project in the desktop editor to edit this page.",409);
    return json({...publicFields(row),theme:row.theme,blocks});
  }
  if(p==="/api/media/rumble" && reading) {
    const cors={"Access-Control-Allow-Origin":"*","Cache-Control":"public, max-age=3600"};
    const raw=u.searchParams.get("url")||"";
    if(raw.length>2048 || !/^https:\/\/(?:www\.)?rumble\.com\/v[a-z0-9]+(?:[-.][a-z0-9._%-]+)?(?:\?[^\s]*)?$/i.test(raw))
      return Response.json({error:"Choose a Rumble video."},{status:400,headers:cors});
    try{
      const response=await fetch("https://rumble.com/api/Media/oembed.json?"+new URLSearchParams({url:raw}),{redirect:"error",headers:{Accept:"application/json"}});
      if(!response.ok)return Response.json({error:"Rumble returned HTTP "+response.status+". Use Share / Embed."},{status:422,headers:{"Access-Control-Allow-Origin":"*"}});
      const data=await response.json(),match=String(data.html).match(/\bsrc="https:\/\/rumble\.com\/embed\/(v[a-z0-9]+)\//i);
      if(!match)throw Error();
      return Response.json({embed:"https://rumble.com/embed/"+match[1]+"/"},{headers:cors});
    }catch{return Response.json({error:"Use the Rumble embed URL."},{status:422,headers:{"Access-Control-Allow-Origin":"*"}});}
  }
  if (p==="/api/feed.xml" && reading) {
    const {results}=await db.prepare("SELECT slug,title,snippet,updated_at FROM member_sites WHERE listed=1 ORDER BY updated_at DESC,slug LIMIT 50").all();
    const entries=results.map(r=>[r.title,new URL(publicMemberUrl(r.slug),u.origin).href,r.snippet,r.updated_at]);
    const xml=entries.map(([title,link,info,date])=>'<item><title>'+e(title)+'</title><link>'+e(link)+'</link><guid>'+e(link)+'</guid><description>'+e(info||'')+'</description>'+(date?'<pubDate>'+new Date(date).toUTCString()+'</pubDate>':'')+'</item>').join('');
    return new Response(request.method==="HEAD"?null:'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>YesterSites updates</title><link>https://yestersites.com/</link><description>Sites from the YesterSites neighborhood</description>'+xml+'</channel></rss>',{headers:{"Content-Type":"application/rss+xml; charset=utf-8","Cache-Control":"public, max-age=60"}});
  }
  if ((p==="/api/directory" || p==="/members/" || p==="/members") && reading) {
    const result=await directory(db,u.searchParams.get("cursor"));
    if (p==="/api/directory") {const response=json(result);response.headers.set("Access-Control-Allow-Origin","*");return response;}
    const items=result.sites.map(site=>'<li><a href="'+site.url+'">'+e(site.title)+'</a> by <a href="'+site.creatorUrl+'">'+e(site.creator)+'</a></li>').join("");
    const more=result.nextCursor?'<p><a href="/members/?cursor='+result.nextCursor+'">Next page</a></p>':"";
    return html(document("YesterSites member directory",(await directoryMemberNav(owner,db))+'<h1>Member homepages</h1>'+(items?"<ul>"+items+"</ul>":"<p>The directory awaits its first listed homepage.</p>")+more+'<p><a href="/studio/">Make a site</a> | <a href="/">YesterSites</a></p>'));
  }
  const shelf=p.match(/^\/creators\/([a-f0-9]{32})\/?$/);
  if (shelf && reading) {
    const cursor=u.searchParams.get("cursor") || "";
    if (cursor && (!slugPattern.test(cursor) || cursor.length>40)) throw new Issue("Invalid profile cursor.");
    return publicProfile(db,shelf[1],cursor,owner);
  }
  const asset=p.match(/^\/members\/([a-z0-9-]{1,40})\/images\/(\d{1,2})$/);
  if (asset && reading) {
    const idx = Number(asset[2]);
    const row=await db.prepare("SELECT json_extract(blocks_json, CASE json_type(blocks_json) WHEN 'array' THEN ? ELSE ? END) AS image FROM member_sites WHERE slug=?").bind("$["+idx+"]","$.items["+idx+"]",asset[1]).first();
    const block=row?.image && JSON.parse(row.image);
    if (block?.type!=="image" && block?.kind!=="image") throw new Issue("Image not found.",404);
    const {bytes,mime}=block.kind==="image"?desktopImage(block.src):imageData(block.url);
    return new Response(bytes,{headers:{...defaultHeaders,"Content-Type":mime}});
  }
  const page=p.match(/^\/members\/([a-z0-9-]{1,40})(?:\/(?:index\.html|(text\.html))?)?$/);
  if (page && reading) {
    const row=await db.prepare("SELECT slug,creator_key,title,profile,theme,byline,listed,blocks_json FROM member_sites WHERE slug=?").bind(page[1]).first();
    if (!row) return html(document("Page not found",'<h1>No homepage at this address</h1><a href="/members/">Member directory</a>'),404);
    return html(renderSite(row,Boolean(page[2])));
  }
  if (!reading) return json({error:"Method not allowed."},405);
  return json({error:"Page not found."},404);
}
export default { async fetch(request,env) {
  try {
    const response=await route(request,env);
    if (request.method==="HEAD") return new Response(null,{status:response.status,headers:response.headers});
    return response;
  } catch (error) {
    if (error instanceof Issue) return json({error:error.message},error.status);
    console.error("Member page request failed",error.name);
    return json({error:"Member publishing is temporarily unavailable. Please try again."},503);
  }
} };
