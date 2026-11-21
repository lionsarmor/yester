(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const max = 16*1024*1024;
  const draftKey = 'yestersites-publish-after-signin';
  const profileNames = {classic:'1990s graphical', millennium:'Early 2000s', text:'Text / BBS'};
  const fragment = location.hash;
  if (fragment) history.replaceState(null, '', location.pathname + location.search);
  let doc = null, signedIn = false, sending = false, completed = false, message = '';
  function refresh() {
    $('send').disabled = !doc || !signedIn || sending || completed;
    $('signin').hidden = signedIn;
    $('review').hidden = !doc;
    $('state').textContent = message || (doc ? 'Ready for review.' : 'Choose your saved project to continue.');
  }
  function load(input) {
    const value = input?.document || input;
    if (!value || !Array.isArray(value.items) || (!value.items.length && !value.bbsScreen?.length) || value.items.length>64 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug || '') || value.slug.length>40 ||
        typeof value.title !== 'string' || !Object.hasOwn(profileNames,value.profile)) {
      throw new Error('Open a saved desktop project with a title, site address and a page object or BBS block.');
    }
    if (new Blob([JSON.stringify(value)]).size>max) throw new Error('This project exceeds the 16 MiB publishing limit.');
    doc = RetroModel.normalize(value); completed = false; message = '';
    $('title').textContent = doc.title;
    $('address').textContent = location.host + '/members/' + doc.slug + '/';
    $('byline').textContent = doc.byline || doc.slug;
    $('profile').textContent = profileNames[doc.profile];
    $('dimensions').textContent = [doc,...doc.pages||[]].length+' pages · '+[doc,...doc.pages||[]].reduce((n,p)=>n+p.items.length,0)+' objects';
    $('listed').textContent = doc.listed ? 'Include in the member directory' : 'Unlisted';
    $('result').replaceChildren();
    historyList(); refresh();
  }
  function failure(err) {
    message = err.message || 'Could not read the project.';
    doc = null; $('result').replaceChildren(); refresh();
  }
  try {
    const encoded = new URLSearchParams(fragment.slice(1)).get('draft');
    let prior = null;
    try { prior = sessionStorage.getItem(draftKey); sessionStorage.removeItem(draftKey); } catch {}
    if (encoded) {
      if (encoded.length > Math.ceil(max*4/3)+4) throw new Error('Project link is too large. Choose your .yst file.');
      const bytes = Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
      load(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    } else if (prior) load(JSON.parse(prior));
  } catch { failure(new Error('Reopen your saved .yst file to continue.')); }
  $('project').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file || sending) return;
    try {
      if (file.size>2*max) throw new Error('File is too large. Reduce the images in your desktop editor.');
      load(JSON.parse(await file.text()));
    } catch (err) { failure(err); }
  });
  $('signin').addEventListener('click', () => {
    if (doc) try { sessionStorage.setItem(draftKey, JSON.stringify(doc)); } catch {}
  });
  async function historyList(){
    const section=$('history-section');section.hidden=true;
    if(!doc||!signedIn)return;
    const slug=doc.slug;
    try{
      const response=await fetch('/api/site/'+slug+'/revisions');
      if(!response.ok||doc?.slug!==slug)return;
      const data=await response.json(),versions=$('versions');versions.replaceChildren();
      for(const r of data.revisions)versions.add(new Option(new Date(r.created).toLocaleString()+(r.id===data.current?' (current)':''),r.id));
      const previous=data.revisions.find(r=>r.id!==data.current);if(previous)versions.value=previous.id;
      section.hidden=!previous;
    }catch{section.hidden=true;}
  }
  $('restore').onclick=async()=>{
    if(!doc||sending)return;
    const revision=$('versions').value;
    if(!confirm('Restore this version at the live site address?'))return;
    sending=true; refresh();
    try{
      const response=await fetch('/api/site/'+doc.slug+'/rollback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      const a=document.createElement('a');a.href=data.url;a.textContent='Visit restored site';$('result').replaceChildren(a);message='Version restored.';completed=false;await historyList();
    }catch(err){message=err.message;}finally{sending=false;refresh();}
  };
  $('send').addEventListener('click', async () => {
    if (!doc || !signedIn || completed || sending) return;
    sending=true; message='Publishing…'; $('project').disabled=true; refresh();
    try {
      const response=await fetch('/api/desktop/publish',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(await hostedProject(doc))});
      const data=await response.json();
      if (!response.ok) {
        if(response.status===401) signedIn=false;
        throw new Error(data.error || 'Publishing failed. Your local project is still saved.');
      }
      if(!['/members/'+doc.slug+'/','https://'+doc.slug+'.yestersites.com/'].includes(data.url)) throw new Error('Unexpected publish response. Check your site address.');
      completed=true; message='Published.';await historyList();
      const link=document.createElement('a'); link.href=data.url; link.textContent='Open '+doc.title;
      const plain=document.createElement('a'); plain.href=data.url+'text.html'; plain.textContent='Text edition';
      $('result').replaceChildren(link,' · ',plain);
    } catch(err) { message=err.message || 'Publishing failed. Retry when connected.'; }
    finally { sending=false; $('project').disabled=false; refresh(); }
  });
  refresh();
  fetch('/api/me',{credentials:'same-origin',headers:{Accept:'application/json'}})
    .then(async r=>{if(!r.ok)throw new Error(); const data=await r.json();
      signedIn=data.authenticated===true;historyList(); if (!signedIn && doc) message='Sign in before publishing this project.'; refresh();})
    .catch(()=>{message='Open this publishing desk on your hosted YesterSites service and sign in.';refresh();});
})();
