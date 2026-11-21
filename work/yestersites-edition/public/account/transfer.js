(async()=>{
  const $=id=>document.getElementById(id),state=$('state');
  function database(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('yestersites-publishing',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('drafts',{keyPath:'id'});
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  const db=await database();
  const access=(mode,op)=>new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts',mode),request=op(tx.objectStore('drafts'));
    tx.oncomplete=()=>resolve(request?.result);tx.onabort=()=>reject(tx.error);
  });
  const ttl=24*60*60*1000;
  await access('readwrite',store=>{
    const req=store.openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(Date.now()-c.value.time>ttl)c.delete();c.continue();}};
  });
  if($('transfer')){
    const id=crypto.randomUUID();
    await access('readwrite',s=>s.put({id,time:Date.now(),doc:JSON.parse($('transfer').textContent)}));
    location.replace('/account/publish/?draft='+id);return;
  }
  const id=new URLSearchParams(location.search).get('draft');
  const row=await access('readonly',s=>s.get(id));
  if(!row)throw Error('This publishing session has expired. Open Publish in the editor again.');
  function showReceipt(url){
    const legacy=/^\/members\/([a-z0-9-]{1,40})\/$/.exec(url);
    const canonical=/^https:\/\/([a-z0-9-]{1,40})\.yestersites\.com\/$/.exec(url);
    if(!legacy && !canonical)throw Error('Invalid member site address.');
    state.textContent='Your site is live.';
    const link=document.createElement('a');link.className='button primary';link.href=new URL(url,location.origin).href;link.textContent='Visit my site';
    const label=document.createElement('p');label.textContent=canonical?canonical[1]+'.yestersites.com':legacy[1]+'.yestersites.com · DNS pending; the site is available below.';$('result').replaceChildren(label,link);$('retry').hidden=true;
  }
  if(row.url){showReceipt(row.url);return;}
  const form=$('retry'),slug=form.elements.slug;slug.value=row.doc.slug;
  let sending=false;
  async function publish(){
    if(sending)return;sending=true;form.hidden=true;
    try{
      row.doc.slug=slug.value.trim();await access('readwrite',s=>s.put(row));
      state.textContent='Publishing '+row.doc.title+'…';
      const available=await fetch('/api/address?slug='+encodeURIComponent(row.doc.slug));
      if(available.ok){
        const result=await available.json();
        if(result.state==='claimed')throw Error('Taken. Choose another site address.');
        state.textContent=result.state==='owned'?'Your site — publishing changes…':'Available — publishing…';
      }
      const project=await hostedProject(row.doc);
      const res=await fetch('/api/editor/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,document:project,source:row.doc})});
      if(res.status===401){location.replace('/signin/?returnTo='+encodeURIComponent(location.pathname+location.search));return;}
      const receipt=await res.json();if(!res.ok)throw Error(receipt.error);
      if(!['/members/'+row.doc.slug+'/','https://'+row.doc.slug+'.yestersites.com/'].includes(receipt.url))throw Error('The server returned an unexpected address.');
      showReceipt(receipt.url);
      await access('readwrite',s=>s.put({id,time:Date.now(),url:receipt.url}));
    }catch(error){state.textContent=error.message||'Publishing failed. You can retry.';form.hidden=false;}
    finally{sending=false;}
  }
  slug.oninput=async()=>{
    const value=slug.value.trim();$('availability').textContent='';
    if(!form.checkValidity())return;
    try{const data=await(await fetch('/api/address?slug='+encodeURIComponent(value))).json();
      if(value===slug.value.trim())$('availability').textContent=({owned:'Your site. Publishing will update it.',available:'Available',claimed:'Already claimed'})[data.state]||'';
    }catch{}
  };
  form.onsubmit=event=>{event.preventDefault();publish();};await publish();
})().catch(error=>{document.getElementById('state').textContent='Could not resume publishing. '+(error.message||'Allow browser storage and try Publish again.');});
