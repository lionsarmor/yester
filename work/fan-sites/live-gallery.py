from pathlib import Path
from shutil import copy2
from html import escape
root=Path.cwd(); out=root/'outputs/fan-sites'; e=out/'evidence'
gallery=root/'work/github-pages/desktop/8bit'
copy2(out/'YESTER.PRG',gallery/'YESTER.PRG')
machines=[
 ('x16','Commander X16','The YesterSites reader runs on the LionsArmor Wi-Fi emulator. It requests the HTML at yestersites.com through the emulated TexElec card, extracts text and links on the X16, and follows links when you press a number. Press S to switch sites.',['moon-relay-home','player-two-home'],e/'x16-live'),
 ('next','Spectrum Next','The Z80 reader sends a key over the emulated UART. A host gateway fetches the linked HTTPS page and returns text for the guest to draw.',['next-anime-home','next-nintendo-home'],e/'eight-online'),
 ('spectrum48','Spectrum 48K','The Z80 reader writes a request through an emulated DivMMC file interface. A workstation gateway fetches the page and returns its text through that interface.',['spectrum48-anime-home','spectrum48-nintendo-home'],e/'eight-online')]
titles=['Moon Relay Tape Shrine','Player Two Repair Club']
parts=[]
for key,machine,explain,names,folder in machines:
 parts.append(f'<section id="live-{key}"><h2>Live on the {machine}</h2><p>{escape(explain)}</p><div class="screens">')
 for title,name in zip(titles,names):
  src=f'screens/{key}-{name}-live.png'
  copy2(folder/(name+'.png'),gallery/src)
  parts.append(f'<figure><a href="{src}"><img loading="lazy" src="{src}" alt="{title} displayed by the {machine}"></a><figcaption>{title}</figcaption></figure>')
 parts.append('</div>')
 if key=='x16':parts.append('<p><a href="YESTER.PRG" download="YESTER.PRG">Download the live X16 reader</a> · <a href="https://github.com/lionsarmor/X16-emulator-wifi-support">LionsArmor Wi-Fi emulator</a></p>')
 parts.append('</section>')
p=gallery/'index.html'
s=p.read_text().replace('<h2>Load the local editions</h2>',''.join(parts)+'<h2>Load the local editions</h2>')
p.write_text(s)
