"""Exercise the actual web Publish button and the signed-in review UI on the local D1 fixture."""
import asyncio
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

import websockets

root = Path(__file__).resolve().parents[1]
probe = (root / 'preview-qa/probe.py').read_text()
exec(probe[probe.index('class Browser:'):probe.index('async def run():')])

async def run(port, base, outfile):
    for _ in range(200):
        try:
            ws = await websockets.connect(f'ws://127.0.0.1:{port}/session', max_size=40_000_000)
            break
        except OSError:
            await asyncio.sleep(.1)
    else:
        raise RuntimeError('Firefox failed to open its local browser session')
    try:
        b=Browser(ws)
        await b.command('session.new',capabilities={'alwaysMatch':{}})
        try:
            b.ctx=(await b.command('browsingContext.getTree'))['contexts'][0]['context']
            desktop_input=os.environ.get('RETRO_TEST_DESKTOP_DRAFT')
            if desktop_input:
                import base64
                data=json.loads(Path(desktop_input).read_text())
                slug=data.get('document',data)['slug']
                fragment=base64.urlsafe_b64encode(Path(desktop_input).read_bytes()).decode().rstrip('=')
                await b.nav(base+'/desktop/publish/#draft='+fragment)
            else:
                slug='late-night-web'
                await b.nav(base+'/editor/')
                await b.eval("""window.qaTarget=''; HTMLAnchorElement.prototype.click=function(){window.qaTarget=this.href}; window.alert=(s)=>window.qaAlert=s;""")
                await b.eval("document.querySelector('#toolbar [data-action=publish]').click()")
                await b.eval("document.querySelector('#dialog-fields [name=slug]').value='late-night-web';document.querySelector('#dialog-fields [name=subject0]').value='radio';document.querySelector('#dialog-fields [name=listed]').checked=true;document.querySelector('#dialog-submit').click()")
                for _ in range(100):
                    target=await b.eval('window.qaTarget')
                    if target:break
                    error=await b.eval('window.qaAlert')
                    if error:raise AssertionError(error)
                    await asyncio.sleep(.05)
                assert target and urlsplit(target).netloc=='yestersites.com', 'web editor did not hand off to publishing desk'
                route=urlsplit(target)
                assert route.fragment.startswith('draft=')
                import base64
                draft=base64.urlsafe_b64decode(route.fragment[6:]+'===')
                data=json.loads(draft)
                assert len(data.get('document',data)['pages'])==2
                if outfile: outfile.write_bytes(draft)
                await b.nav(base+route.path+'#'+route.fragment)
            for _ in range(100):
                if await b.eval("document.querySelector('#send')?.disabled===false"):break
                await asyncio.sleep(.05)
            assert await b.eval("!document.querySelector('#send').disabled"),await b.eval("document.querySelector('#state').textContent")
            await b.eval("document.querySelector('#send').click()")
            for _ in range(160):
                path=await b.eval("document.querySelector('#result a')?.pathname")
                if path:break
                await asyncio.sleep(.05)
            assert path=='/members/'+slug+'/',await b.eval("document.querySelector('#state').textContent")
            await b.nav(base+path)
            await b.eval("Promise.all([...document.images].map(i=>i.decode())).then(()=>true)")
            assert await b.eval("document.title==='Late Night Signal'")
            assert await b.eval("[...document.images].some(i=>i.alt.toUpperCase().includes('LATE NIGHT') && i.naturalWidth>0)"),'title art missing'
            await b.eval("[...document.links].find(a=>a.textContent.trim()==='Station Log').click()")
            for _ in range(100):
                if await b.eval("document.title==='Station Log'"):break
                await asyncio.sleep(.05)
            assert await b.eval("document.title==='Station Log'")
            await b.nav(base+'/desktop/publish/')
            modified=data.get('document',data)
            modified['title']='Second edition test'
            await b.eval("(()=>{const file=new File(["+json.dumps(json.dumps({'document':modified}))+ "],'changed.yst',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.getElementById('project');input.files=dt.files;input.dispatchEvent(new Event('change'));})()")
            for _ in range(100):
                if await b.eval("document.querySelector('#send')?.disabled===false"):break
                await asyncio.sleep(.05)
            await b.eval("document.querySelector('#send').click()")
            for _ in range(120):
                if await b.eval("document.querySelector('#result a') && !document.getElementById('history-section').hidden"):break
                await asyncio.sleep(.05)
            assert await b.eval("!document.getElementById('history-section').hidden")
            assert await b.eval("document.getElementById('result').textContent.includes('Second edition test')")
            await b.eval("window.confirm=()=>true;document.querySelector('#restore').click()")
            for _ in range(120):
                if await b.eval("document.getElementById('state').textContent==='Version restored.'"):break
                await asyncio.sleep(.05)
            assert await b.eval("document.getElementById('state').textContent==='Version restored.'")
            await b.nav(base+path)
            assert await b.eval("document.title==='Late Night Signal'"),'failed to restore original title'
            print('Firefox verified '+('desktop' if desktop_input else 'web')+' editor handoff, signed-in review, publication, title graphic, Station Log, .yst file re-upload, revision selection and restoration.')
        finally:
            await b.command('session.end')

    finally:
        await ws.close()

if __name__=='__main__':
    with tempfile.TemporaryDirectory(prefix='retro-web-publish-qa-') as profile:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        process=subprocess.Popen(['firefox','--headless','--no-remote','--profile',profile,'--remote-debugging-port',str(port),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        try:asyncio.run(run(port,sys.argv[1],Path(sys.argv[2]) if len(sys.argv)>2 else None))
        finally:
            os.killpg(process.pid,signal.SIGTERM)
            process.wait(timeout=10)
