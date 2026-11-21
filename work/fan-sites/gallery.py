from pathlib import Path
from shutil import copy2
from zipfile import ZIP_DEFLATED, ZipFile
from html import escape
root=Path.cwd();output=root/'outputs/fan-sites'
web=root/'work/github-pages/desktop/8bit';web.mkdir(exist_ok=True)
sites={'moon-relay':'Moon Relay Tape Shrine','player-two':'Player Two Repair Club'}
machines=[('c64','Commodore 64','SIGNAL64.PRG'),('x16','Commander X16','SIGNAL16.PRG'),('next','ZX Spectrum Next','SIGNAL.NEX'),('spectrum48','ZX Spectrum 48K','SIGNAL48.SNA')]
for slug in sites:
 with ZipFile(web/(slug+'-8bit.zip'),'w',ZIP_DEFLATED) as z:
  for machine,name,file in machines:
   z.write(root/'work/fan-sites/lab'/slug/file, machine+'/'+file)
  z.writestr('READ-ME.txt','Local editions of '+sites[slug]+'\r\n\r\nC64 and X16: load and run the PRG. Next: launch the NEX. 48K: load the SNA snapshot.\r\n1/2 follow links, H returns home and N/P page through text.\r\nLive text: https://yestersites.com/'+slug+'/text.html\r\n')
img=web/'screens';img.mkdir(exist_ok=True)
def figures(machine,live=False):
 parts=[]
 for slug,title in sites.items():
  src=output/'evidence'/slug/(machine+'-home.png')
  if live:src=output/'evidence/live'/('c64-serial-'+slug+'-home.png')
  name=slug+'-'+('live-' if live else '')+machine+'.png'
  copy2(src,img/name)
  parts.append(f'<figure><a href="screens/{name}"><img loading="lazy" src="screens/{name}" alt="{escape(title)} running in the {machine.upper()} emulator"></a><figcaption>{title}</figcaption></figure>')
 return '<div class="screens">'+''.join(parts)+'</div>'
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YesterSites on 8-bit computers</title><link rel="icon" href="/favicon.ico"><style>
body{max-width:960px;margin:0 auto;padding:18px;background:#f5ebd5;color:#20182c;font:16px Georgia,serif} h1,h2{font-family:Verdana,sans-serif}h2{margin:1.2em 0 .4em}a{color:#442c85}.screens{display:flex;gap:12px;align-items:start;flex-wrap:wrap}figure{flex:1 1 250px;margin:0}img{display:block;width:100%;height:auto;background:black}figcaption{padding:4px 0 9px;font-weight:bold}
</style><body><nav><a href="/">YesterSites</a> / <a href="/desktop/">Retro Page</a></nav><h1>The 8-bit editions</h1>
<h2>Live on the Commodore 64</h2><p>These VICE captures show pages fetched from yestersites.com. The guest sends a key over emulated SwiftLink. A workstation gateway requests the linked HTTPS page and sends its text to the guest.</p>'''+figures('c64',True)+'''<p><a href="/moon-relay/text.html">Read Moon Relay on the web</a> · <a href="/player-two/text.html">Read Player Two on the web</a></p>
<h2>Load the local editions</h2><p>Each ZIP includes a C64 PRG, X16 PRG, Spectrum Next NEX and Spectrum 48K snapshot. Press 1 or 2 to open a page, H for home, or N and P to turn a screen.</p>
<p><a href="moon-relay-8bit.zip">Moon Relay machine files</a> · <a href="player-two-8bit.zip">Player Two machine files</a></p>'''
for key,name,_ in machines:
 html+=f'<h2>{name} · local edition</h2>'+figures(key)
(web/'index.html').write_text(html+'</body></html>\n')
p=web.parent/'index.html';s=p.read_text();needle='<h2>Save and share your site</h2>';p.write_text(s.replace(needle,'<p><a href="8bit/">See the 8-bit editions and download the machine files</a></p>\n'+needle))
copy2(p,root/'outputs/desktop/index.html')
