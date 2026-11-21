import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from './router.mjs';
const sample='https://signal.yestersites.com',origin='https://yestersites-webring.jamesmweeksjr.chatgpt.site',apex='https://yestersites.com';
test('stock home, image and neighboring sites keep their own origin',async()=>{
  const calls=[];
  const reply=async(url,init)=>{
    calls.push(url);assert.equal(init.headers.get('cookie'),null);
    if(url.startsWith(origin))return Response.redirect(url.replace(origin,apex),302);
    return new Response('<a href="/members/orbit/cards.html">Cards</a><img src="art/a.gif"><a href="/index.html">Directory</a>',{headers:{'content-type':'text/html','set-cookie':'bad=1'}});
  };
  const res=await route(new Request(sample+'/?q=sky',{headers:{Cookie:'ignore=1'}}),reply);
  assert.deepEqual(calls,[origin+'/members/signal/?q=sky','http://127.0.0.1:8138/members/signal/?q=sky']);assert.equal(res.headers.get('set-cookie'),null);
  const html=await res.text();assert.ok(html.includes('https://orbit.yestersites.com/cards.html'));assert.ok(html.includes(sample+'/art/a.gif'));assert.ok(html.includes(apex+'/index.html'));
});
test('new publication requires no router entry, supports files and a same-origin guestbook',async()=>{
  const host='https://fresh-creator.yestersites.com';
  const reply=async(url,opts)=>{
    assert.equal(url,origin+'/members/fresh-creator/guestbook/');
    assert.equal(opts.headers.get('origin'),origin);assert.equal(await new Response(opts.body).text(),'name=Pat');
    return new Response(null,{status:303,headers:{location:'/members/fresh-creator/guestbook/'}});
  };
  let r=await route(new Request(host+'/guestbook/',{method:'POST',headers:{origin:host,'content-type':'application/x-www-form-urlencoded'},body:'name=Pat'}),reply);
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),host+'/guestbook/');
  r=await route(new Request(host+'/guestbook/',{method:'POST',headers:{origin:sample}}),reply);assert.equal(r.status,403);
  r=await route(new Request(host+'/image.gif',{headers:{Range:'bytes=0-3'}}),async(url,opts)=>{
    assert.equal(url,origin+'/members/fresh-creator/image.gif');assert.equal(opts.headers.get('range'),'bytes=0-3');
    return new Response('GIF8',{status:206,headers:{'content-type':'image/gif','content-range':'bytes 0-3/100'}});
  });assert.equal(r.status,206);assert.equal(await r.text(),'GIF8');
});
test('certificate permission validates exact host and actual publication',async()=>{
  const ask=name=>new Request('https://127.0.0.1:8137/ask?domain='+name);
  assert.equal((await route(ask('signal.yestersites.com'),async u=>{assert.equal(u,origin+'/api/member-host?slug=signal');return new Response(null,{status:204});})).status,204);
  assert.equal((await route(ask('unclaimed.yestersites.com'),async()=>new Response(null,{status:404}))).status,403);
  for(const name of ['www.yestersites.com','notyestersites.com','a.b.yestersites.com'])assert.equal((await route(ask(name))).status,403);
});

test('classic pages hide script contents and use navigable local filenames',async()=>{
  const page='b'.repeat(32);
  const source='<html><body><img src="/members/signal/media/abc/4.GIF"><script type="text/javascript">injected plain text</script><a href="page-'+page+'-classic.html#news">News</a><a href="https://elsewhere.test/item">Elsewhere</a></body></html>';
  const html=()=>new Response(source,{headers:{'content-type':'text/html; charset=utf-8'}});
  const res=await route(new Request(sample+'/classic.html'),html);
  const out=await res.text();
  assert.ok(!out.includes('injected') && !out.includes('<script'));
  assert.ok(out.includes('src="/media/abc/4.GIF"'));
  assert.ok(out.includes('href="/classic/'+page+'/INDEX.HTM#news"'));
  assert.ok(out.includes('href="https://elsewhere.test/item"'));
  await route(new Request(sample+'/classic/'+page+'/INDEX.HTM'),async(url)=>{
    assert.equal(url,origin+'/members/signal/page-'+page+'-classic.html');
    return html();
  });
  assert.ok((await(await route(new Request(sample+'/modern.html'),html)).text()).includes('injected'));
});
