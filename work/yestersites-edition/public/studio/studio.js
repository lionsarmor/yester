'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const kinds = {heading:'Heading',paragraph:'Paragraph',link:'Link',image:'Image',rule:'Horizontal rule'};
  const palettes = {
    paper:['#fffbe8','#262134','#412286','#e4d7b0'], night:['#100e22','#fff6d8','#9aedef','#38314c'],mint:['#e4f2dc','#153826','#66398e','#b9d5ae']
  };
  const labels = {text:'Text / BBS',classic:'Graphical · 1990s',millennium:'Early 2000s'};
  const protocolOK = ['https:','http:'].includes(location.protocol);
  const editSlug = new URLSearchParams(location.search).get('edit') || '';
  const key = 'ystudio-draft-3:'+(editSlug || 'desk');
  const imageLimit = 96*1024;
  const maxBody = 512*1024;
  const defaults = () => ({title:'My corner of the web',slug:'',byline:'',profile:'classic',theme:'paper',listed:false,blocks:[{type:'heading',text:'Welcome to my homepage!'},{type:'paragraph',text:'I made this little corner of the web for the things I like. Pull up a chair.'}]});
  let draft = defaults(), selected = 0, signed = false, connected = false, busy = false, dragged = null, version = 0;
  let loadError = false;
  const safeSlug = s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 40;
  const safeImage = s => typeof s === 'string' && /^(data:image\/(?:gif|jpeg);base64,)[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length <= imageLimit*4/3+40;
  const href = raw => {
    const s = (raw || '').trim();
    if (/[\\\s]/.test(s)) return '';
    if (/^\/(?!\/)/.test(s) && !/[\\\x00-\x20]/.test(s)) return s;
    try { const u = new URL(s); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
    catch { return ''; }
  };
  const esc = text => String(text || '').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x]);
  const isDoc = s => s && typeof s.title === 'string' && typeof s.slug === 'string' && Object.hasOwn(labels,s.profile) && Object.hasOwn(palettes,s.theme) && Array.isArray(s.blocks) && s.blocks.length <= 64 && s.blocks.every(b=>b && Object.hasOwn(kinds,b.type) && (b.type==='rule'||typeof b.text==='string') && (b.url===undefined||typeof b.url==='string'));
  const warn = s => { $('status').textContent=s; };
  const snapshot = () => {
    version++;
    try{localStorage.setItem(key,JSON.stringify(draft));warn('Draft saved on this device.');}
    catch{warn('Device storage unavailable. Export HTML to keep a copy.');}
  };
  let hasLocal = false;
  try{const restored=JSON.parse(localStorage.getItem(key));if(isDoc(restored)){draft=restored;hasLocal=true;}}
  catch{}
  function presentation(d,edit,imagePaths=null,editionLink='') {
    const [bg,fg,link,panel]=palettes[d.theme];
    let body='';
    const marks = i => edit?' data-block="'+i+'"':'';
    for(let i=0;i<d.blocks.length;i++){
      const b=d.blocks[i],t=esc(b.text),a=marks(i);
      if(b.type==='heading') body+='<h2'+a+'>'+(t||'Untitled heading')+'</h2>';
      if(b.type==='paragraph') body+='<p'+a+'>'+t.replace(/\n/g,'<br>')+'</p>';
      if(b.type==='link') body+='<p'+a+'><a href="'+esc(href(b.url)||'#')+'">'+(t||'New link')+'</a></p>';
      if(b.type==='rule') body+='<div'+a+'><hr></div>';
      if(b.type==='image'){
        if(d.profile==='text') body+='<p'+a+'>[Image: '+(t||'Untitled')+']</p>';
        else body+='<p'+a+'>'+(safeImage(b.url)?'<img src="'+(imagePaths?.get(i)||b.url)+'" alt="'+t+'" style="max-width:100%;height:auto">':'[Choose an image file]')+'</p>';
      }
    }
    const by=d.byline||d.slug;
    const header='<h1>'+esc(d.title||'Untitled homepage')+'</h1>'+(by?'<p>By '+esc(by)+'</p>':'');
    const title=esc(d.title||'Untitled homepage');
    let markup=header+'<hr>'+body;
    let css='img{max-width:100%;height:auto}body{overflow-wrap:anywhere}';
    if(d.profile!=='text'){
      css+='*{box-sizing:border-box}body{background:'+bg+';color:'+fg+';margin:1em auto;padding:0 1em;max-width:48em}a{color:'+link+'}';
      if(d.profile==='classic'){
        css+='h1{text-align:center;font-family:Georgia,serif}table{margin:1em auto}';
        markup='<table width="100%" border="3" cellpadding="8" cellspacing="2"><tr><td align="center" bgcolor="'+panel+'">'+header+'</td></tr></table>'+body;
      }else{
        css+='body{font:1rem/1.5 Verdana,Arial,sans-serif}.window{border:3px outset '+panel+'}.bar{background:'+panel+';border-bottom:2px groove '+panel+';padding:12px 18px}.bar h1,.bar p{margin:0}.content{padding:3px 18px}.bar h1{font-family:Trebuchet MS,Arial,sans-serif}';
        markup='<div class="window"><div class="bar">'+header+'</div><div class="content">'+body+'</div></div>';
      }
    }
    if(editionLink)markup+='<hr><p><a href="'+editionLink+'">'+(editionLink==='text.html'?'Text edition':'Main edition')+'</a></p>';
    const attrs=d.profile==='text'?'':' bgcolor="'+bg+'" text="'+fg+'" link="'+link+'" vlink="'+link+'"';
    if(edit)css+='[data-block]{cursor:pointer;min-height:1em}[data-block]:hover{outline:1px dashed '+link+'}';
    return '<!doctype html>\n<html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style></head><body'+attrs+'>'+markup+'</body></html>';
  }
  function select(index,focus=false){
    selected=index;
    const b=draft.blocks[index];
    $('inspector').hidden=!b;
    if(b){
      $('selected-label').textContent='Edit '+kinds[b.type].toLowerCase();
      $('copy-label').textContent=b.type==='image'?'Image description':b.type==='link'?'Link text':'Text';
      $('copy-label').hidden=$('copy').hidden=b.type==='rule';
      $('copy').maxLength=b.type==='paragraph'?4000:300;
      $('copy').value=b.text||'';
      $('url').value=b.type==='link'?b.url||'':'';
      $('link-controls').hidden=b.type!=='link';
      $('image-controls').hidden=b.type!=='image';
      $('file').value='';
      $('up').disabled=index===0;$('down').disabled=index===draft.blocks.length-1;
    }
    Array.from($('outline').querySelectorAll('button')).forEach((el,i)=>el.setAttribute('aria-current',String(index===i)));
    if(focus&&b){if(b.type==='rule')$('remove').focus();else $('copy').focus();}
  }
  function reorder(from,to){
    if(from<0||from>=draft.blocks.length||to<0||to>=draft.blocks.length||from===to)return;
    draft.blocks.splice(to,0,draft.blocks.splice(from,1)[0]);selected=to;snapshot();draw();
  }
  function outline(){
    $('outline').replaceChildren();
    draft.blocks.forEach((b,i)=>{
      const li=document.createElement('li'),btn=document.createElement('button');
      btn.type='button';btn.draggable=true;
      btn.textContent=(i+1)+'. '+(b.type==='rule'?'────────':(b.text||kinds[b.type]));
      btn.title=kinds[b.type]+' · drag to reorder';btn.setAttribute('aria-current',String(selected===i));
      btn.onclick=()=>select(i,true);
      btn.ondragstart=e=>{dragged=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));};
      btn.ondragend=()=>{dragged=null;};
      btn.ondragover=e=>{if(dragged!==null)e.preventDefault();};
      btn.ondrop=e=>{e.preventDefault();if(dragged!==null)reorder(dragged,i);dragged=null;};
      li.append(btn);$('outline').append(li);
    });
  }
  function preview(){
    $('format-label').textContent=labels[draft.profile];
    $('theme').disabled=draft.profile==='text';
    $('size').textContent=draft.blocks.length+' / 64 items';
    $('canvas').srcdoc=presentation(draft,true);
  }
  function draw(){
    for(const k of ['title','byline','slug','theme','profile'])$(k).value=draft[k]||'';
    $('slug').readOnly=Boolean(editSlug);
    $('listed').checked=!!draft.listed;outline();select(Math.min(selected,draft.blocks.length-1));preview();
  }
  $('canvas').addEventListener('load',()=>{
    const doc=$('canvas').contentDocument;
    if(doc)doc.addEventListener('click',ev=>{
      const el=ev.target.closest('[data-block]');ev.preventDefault();if(el)select(Number(el.dataset.block),true);
    });
  });
  for(const key of ['title','slug','byline','theme','profile']){
    $(key).addEventListener(['theme','profile'].includes(key)?'change':'input',()=>{draft[key]=$(key).value;snapshot();preview();});
  }
  for(const [id,prop] of [['copy','text'],['url','url']]){
    $(id).addEventListener('input',()=>{
      const b=draft.blocks[selected];if(!b)return;
      b[prop]=$(id).value;snapshot();outline();preview();
    });
  }
  $('file').addEventListener('change',async ()=>{
    const file=$('file').files[0], b=draft.blocks[selected];
    if(!file||!b||b.type!=='image')return;
    try{
      if(file.size>imageLimit)throw Error('Choose a GIF or JPEG no larger than 96 KiB.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const sig=String.fromCharCode(...bytes.slice(0,6));
      const mime=/^GIF8[79]a$/.test(sig)?'image/gif':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
      if(!mime)throw Error('Choose a GIF or JPEG image.');
      const reader=new FileReader();
      reader.onload=()=>{
        if(!draft.blocks.includes(b))return;
        b.url=String(reader.result);snapshot();preview();warn('Image added. Describe it for text browsers.');
      };
      reader.onerror=()=>warn('The image could not be read.');
      reader.readAsDataURL(file.slice(0,file.size,mime));
    }catch(e){warn(e.message);}
  });
  $('add').onclick=()=>{
    const type=$('kind').value;
    if(draft.blocks.length>=64){warn('This page already has 64 items.');return;}
    if(type==='image'&&draft.blocks.filter(b=>b.type==='image').length>=3){warn('A site can include three images.');return;}
    const item=type==='rule'?{type}:type==='image'||type==='link'?{type,text:'',url:''}:{type,text:''};
    selected=Math.max(0,Math.min(selected+1,draft.blocks.length));draft.blocks.splice(selected,0,item);snapshot();draw();select(selected,true);
  };
  $('remove').onclick=()=>{if(selected>=0){draft.blocks.splice(selected,1);snapshot();draw();}};
  $('up').onclick=()=>reorder(selected,selected-1);$('down').onclick=()=>reorder(selected,selected+1);
  $('listed').onchange=()=>{draft.listed=$('listed').checked;snapshot();};
  function validate(publish){
    if(!draft.title.trim())return 'Give the page a title.';
    if(publish&&!safeSlug(draft.slug))return 'Choose an address with 1–40 lowercase letters or digits. Hyphens go between words.';
    if(!draft.blocks.length)return 'Add at least one item to the page.';
    for(let i=0;i<draft.blocks.length;i++){
      const b=draft.blocks[i],prefix='Item '+(i+1)+': ';
      if(b.type!=='rule'&&!b.text.trim())return prefix+(b.type==='image'?'describe the image.':'enter some text.');
      if(b.type==='link'&&!href(b.url))return prefix+'enter an HTTP(S) link or a path beginning with /.';
      if(b.type==='image'&&!safeImage(b.url))return prefix+'choose a GIF or JPEG file.';
    }
    if(publish&&new Blob([JSON.stringify(draft)]).size>maxBody)return 'The page is over 512 KiB. Reduce an image or shorten the page.';
    return '';
  }
  function download(blob,extension){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(safeSlug(draft.slug)?draft.slug:'homepage')+extension;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  $('export').onclick=()=>{
    const issue=validate(false);if(issue){warn(issue);return;}
    download(new Blob([presentation(draft,false)],{type:'text/html;charset=utf-8'}),'.html');
    warn('Standalone HTML exported.');
  };
  $('zip').onclick=()=>{
    const issue=validate(false);if(issue){warn(issue);return;}
    const encoder=new TextEncoder(),images=[],paths=new Map();
    if(draft.profile!=='text'){
      draft.blocks.forEach((b,index)=>{
        if(b.type!=='image')return;
        const ext=b.url.startsWith('data:image/gif;')?'gif':'jpg';
        const name='images/pic'+String(images.length+1)+'.'+ext;
        const binary=atob(b.url.slice(b.url.indexOf(',')+1));
        images.push({name,data:Uint8Array.from(binary,c=>c.charCodeAt(0))});
        paths.set(index,name);
      });
    }
    const graphical=presentation(draft,false,paths,'text.html');
    const plain=presentation({...draft,profile:'text'},false,null,'index.html');
    download(window.makeSiteZip([{name:'index.html',data:encoder.encode(graphical)},
      {name:'text.html',data:encoder.encode(plain)},...images]),'.zip');
    warn('Site ZIP exported. Extract it and open index.html or text.html.');
  };
  $('import').onclick=()=>{
    $('import-msg').textContent='';$('import-file').value='';$('import-dialog').showModal();
  };
  $('import-apply').onclick=async ()=>{
    const f=$('import-file').files[0];
    if(!f||f.size>maxBody){$('import-msg').textContent='Choose an HTML file up to 512 KiB.';return;}
    try{
      const template=document.createElement('template');
      template.innerHTML=await f.text();
      const content=template.content;
      const first=content.querySelector('h1');
      const title=(content.querySelector('title')?.textContent.trim()||first?.textContent.trim()||f.name.replace(/\.html?$/i,'')).slice(0,80);
      first?.remove();
      content.querySelectorAll('script,style,title,link,meta,base,iframe,object,noscript,template,svg,form').forEach(el=>el.remove());
      const blocks=[];let textBuffer='',skipped=0,photos=0;
      const append=b=>{if(blocks.length<64)blocks.push(b);else skipped++;};
      function flush(){
        const clean=textBuffer.replace(/[ \t]+/g,' ').trim();
        if(clean)for(let i=0;i<clean.length;i+=4000)append({type:'paragraph',text:clean.slice(i,i+4000)});
        textBuffer='';
      }
      function walk(node){
        if(node.nodeType===3){textBuffer+=node.textContent.replace(/\s+/g,' ');return;}
        if(node.nodeType!==1&&node.nodeType!==11)return;
        const name=node.nodeName;
        if(/^H[1-6]$/.test(name)){flush();const text=node.textContent.trim().slice(0,300);if(text)append({type:'heading',text});return;}
        if(name==='A'){
          const raw=node.getAttribute('href'),url=href(raw),text=node.textContent.trim();
          if(url&&text){flush();append({type:'link',text:text.slice(0,300),url});return;}
        }
        if(name==='IMG'){
          flush();const url=node.getAttribute('src');
          const alt=node.getAttribute('alt')?.trim();
          if(safeImage(url)&&photos<3){append({type:'image',text:(alt||'Imported image').slice(0,300),url});photos++;}
          else {skipped++;if(alt)append({type:'paragraph',text:'[Image: '+alt.slice(0,300)+']'});}
          return;
        }
        if(name==='HR'){flush();append({type:'rule'});return;}
        if(name==='BR'){textBuffer+='\n';return;}
        const group=['DIV','P','LI','TR','SECTION','ARTICLE','PRE','BLOCKQUOTE'].includes(name);
        if(group)flush();for(const child of node.childNodes)walk(child);if(group)flush();
      }
      walk(content);flush();
      if(!blocks.length){$('import-msg').textContent='No supported page content was found.';return;}
      draft={...draft,title,blocks};selected=0;snapshot();draw();$('import-dialog').close();
      warn('Imported '+blocks.length+' items.'+(skipped?' '+skipped+' unsupported or over-limit items omitted.':''));
    }catch{$('import-msg').textContent='Could not read this HTML file.';}
  };
  $('new').onclick=()=>$('new-dialog').showModal();
  $('start').onclick=()=>{
    $('new-dialog').close();
    if(editSlug){try{localStorage.removeItem('ystudio-draft-3:desk');}catch{}location.assign('./index.html');return;}
    draft=defaults();selected=0;snapshot();draw();
  };
  function signIn(){
    snapshot();
    const returnTo='/studio/'+(editSlug?'?edit='+encodeURIComponent(editSlug):'');
    location.assign('/api/login?returnTo='+encodeURIComponent(returnTo));
  }
  function listAccount(info){
    signed=info.authenticated===true;
    $('account').replaceChildren();
    if(signed){
      $('account').textContent=info.displayName||'Signed in';
      if(!draft.byline&&!hasLocal&&!editSlug&&info.displayName){draft.byline=info.displayName.slice(0,48);$('byline').value=draft.byline;preview();}
    }else{
      const a=document.createElement('a');a.textContent='Sign in';a.href='/api/login?returnTo=%2Fstudio%2F';a.onclick=e=>{e.preventDefault();signIn();};$('account').append(a);
    }
    $('owned').replaceChildren();const sites=Array.isArray(info.sites)?info.sites:[];
    $('my-pages').hidden=!signed||!sites.length;
    for(const site of sites){
      if(!safeSlug(site.slug))continue;
      const li=document.createElement('li'),a=document.createElement('a');a.href=site.studioEditable?'?edit='+encodeURIComponent(site.slug):site.url;a.textContent=site.title||site.slug;li.append(a);$('owned').append(li);
    }
  }
  async function fetchJSON(url,options){
    const response=await fetch(url,{credentials:'same-origin',...options});
    let obj=null;try{obj=await response.json();}catch{}
    if(!response.ok||!obj){const err=new Error(typeof obj?.error==='string'?obj.error:'The server could not complete this request.');err.status=response.status;throw err;}
    return obj;
  }
  async function load(){
    if(!protocolOK){warn('Offline edition. Drafts and HTML export are available on this device.');return;}
    const initialVersion=version;
    try{
      const info=await fetchJSON('/api/me');if(typeof info.authenticated!=='boolean')throw Error();
      connected=true;listAccount(info);
      if(editSlug){
        if(!safeSlug(editSlug))throw Error('Invalid site address.');
        if(!signed){warn('Sign in to edit this published site.');return;}
        const remote=await fetchJSON('/api/site/'+encodeURIComponent(editSlug)+'/edit');
        const doc=remote.site||remote;
        if(!isDoc(doc)||doc.slug!==editSlug)throw Error('The server returned an unreadable page.');
        if(!hasLocal&&version===initialVersion){draft={title:doc.title,slug:doc.slug,byline:doc.byline||'',listed:!!doc.listed,profile:doc.profile,theme:doc.theme,blocks:doc.blocks};selected=0;draw();warn('Published site loaded.');}
        else warn('Your device draft is open.');
      }
    }catch(e){
      if(connected&&editSlug) {loadError=true;warn(e.message||'Could not open this site.');}
      else {$('account').textContent='Offline desk';warn('Publishing service unavailable. You can still edit and export HTML.');}
    }
  }
  $('publish').onclick=()=>{
    if(loadError){warn('This published site could not be opened. Reload before publishing changes.');return;}
    if(!connected){warn('Publishing needs the hosted YesterSites editor. This copy can export HTML.');return;}
    if(editSlug&&!signed){signIn();return;}
    const issue=validate(true);if(issue){warn(issue);return;}
    $('publish-description').textContent='Publish “'+draft.title+'” at the address '+draft.slug+'?';
    $('publish-msg').replaceChildren();$('send').hidden=false;$('send').textContent=signed?'Publish site':'Sign in to publish';$('listed').checked=!!draft.listed;$('publish-dialog').showModal();
  };
  $('send').onclick=async ()=>{
    if(busy)return;
    if(!signed){signIn();return;}
    const issue=validate(true);if(issue){$('publish-msg').textContent=issue;return;}
    busy=true;$('send').disabled=true;$('publish-msg').textContent='Publishing…';
    try{
      const response=await fetchJSON('/api/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      const u=new URL(response.url,location.href);
      if(!['http:','https:'].includes(u.protocol)||!safeSlug(response.slug))throw Error('Unexpected publish response.');
      $('publish-msg').textContent='Published. ';const a=document.createElement('a');a.href=u.href;a.textContent='Open your site';$('publish-msg').append(a);
      const textLink=document.createElement('a');textLink.href=new URL('text.html',u.href.replace(/\/?$/,'/')).href;
      textLink.textContent='Text edition';$('publish-msg').append(' · ',textLink);$('send').hidden=true;warn('Published '+response.slug+'.');
      try{localStorage.setItem('ystudio-draft-3:'+draft.slug,JSON.stringify(draft));}catch{}
      try{listAccount(await fetchJSON('/api/me'));}catch{}
    }catch(e){
      if(e.status===401){signed=false;$('send').textContent='Sign in to publish';}
      $('publish-msg').textContent=e.status===409?'That site address is already claimed. Choose another address.':e.message;
    }finally{busy=false;$('send').disabled=false;}
  };
  draw();if(hasLocal)warn('Device draft restored.');load();
})();
