import asyncio, functools,http.server,threading
from pathlib import Path
h=Path('/tmp/retro-page-web-check.py').read_text()
exec(h[:h.index('async def run(b):')])
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(Path('work/github-pages').resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=os.environ.get('FAN_TEST_ORIGIN',f'http://127.0.0.1:{server.server_port}/')
async def run(b):
 b.ctx=(await b.command('browsingContext.getTree'))['contexts'][0]['context']
 await b.size(900,720)
 for slug in ('player-two','moon-relay'):
  await b.nav(origin+slug+'/')
  assert await b.eval('Promise.all([...document.images].map(i=>i.decode())).then(()=>true)')
  await shot(b,'fan-'+slug)
  await b.size(390,750)
  assert await b.eval('document.documentElement.scrollWidth <= innerWidth')
  await b.size(900,720)
 await b.nav(origin+'retropage/?drawer=gifs')
 for _ in range(70):
  if await b.eval("!!document.querySelector('.gifcities-link')"):break
  await asyncio.sleep(.1)
 await b.eval("""(()=>{let f=document.querySelector('input.stamp-search');f.value='skullsmoke';f.dispatchEvent(new Event('input'));document.querySelector('.gifcities-link').click()})()""")
 for i in range(160):
  if await b.eval("!!document.querySelector('.stamp img[src^=\"https://blob.gifcities\"]')"):break
  await asyncio.sleep(.24)
 assert await b.eval("!!document.querySelector('.stamp img[src^=\"https://blob.gifcities\"]')"),await b.eval("document.querySelector('#drawer-content').innerText")
 # Arm two different archive results before placement and verify the actual embedded bytes.
 import base64,hashlib
 assert await b.eval("document.querySelectorAll('[data-archive]').length>=2")
 await b.eval("""window.skulls=[...document.querySelectorAll('[data-archive]')];skulls[0].click();skulls[1].click();
 const bounds=document.querySelector('#paper').getBoundingClientRect();document.querySelector('#paper').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:bounds.x+30,clientY:bounds.y+30,button:0,pointerId:1}));""")
 for _ in range(160):
  if await b.eval("JSON.parse(localStorage.getItem('roddy.retro-page.project.v1')).doc.items.at(-1).text===skulls[1].title"):break
  await asyncio.sleep(.2)
 src=await b.eval("JSON.parse(localStorage.getItem('roddy.retro-page.project.v1')).doc.items.at(-1).src")
 digest=base64.b32encode(hashlib.sha1(base64.b64decode(src.split(',')[1])).digest()).decode()
 assert digest==await b.eval('skulls[1].dataset.archive')
 assert await b.eval("skulls[1].isConnected && document.querySelector('input.stamp-search').value==='skullsmoke'")
 for slug in ['moon-relay','player-two']:
  el=(await b.command('script.evaluate',expression="document.getElementById('open-file')",target={"context":b.ctx},awaitPromise=False))['result']
  await b.command('input.setFiles',context=b.ctx,element=el,files=[str(Path('outputs/fan-sites',slug+'.yst').resolve())])
  await asyncio.sleep(.4)
  doc=await evaluate(b,"JSON.parse(localStorage.getItem('roddy.retro-page.project.v1')).doc")
  assert doc['slug']==slug and len(doc['pages'])==2,(doc['slug'],slug)
 await b.nav(origin+'crawler/?q=Nintendo')
 await asyncio.sleep(.3)
 assert await b.eval("document.querySelector('#results').innerText.includes('Player Two')")
 await b.eval("document.querySelector('#words').value='skullsmoke';document.querySelector('#gifcities').click()")
 for _ in range(160):
  if await b.eval("!!document.querySelector('#gif-matches img')"):break
  await asyncio.sleep(.24)
 assert await b.eval("!!document.querySelector('#gif-matches img')")
 print('Real Firefox: both phone exports, both imported .yst files, live archive lookup and placement, directory search and inline GifCities matched.',flush=True)
exec(h[h.rindex('async def main():'):])
