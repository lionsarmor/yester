from pathlib import Path
import json,hashlib,shutil
def edit(path,old,new):
 p=Path(path); s=p.read_text(); assert old in s,(path,old);p.write_text(s.replace(old,new))
d=Path('work/desktop-app')
w=Path('work/retro-page-web')
p=d/'assets/objects.json'
data=json.loads(p.read_text())
def preset(key,label,lines,identity=None):
 parts=[]
 for idx,line in enumerate(lines):
  parts.append(dict(kind='text',text=line,dy=idx*24,w=288,h=24 if idx==0 else 80,
                    font_family='Courier New' if identity else 'Verdana',font_size=14,
                    color='#bdf7a6' if identity else ('#fff4c8' if idx==0 else '#292037'),
                    fill='#13271c' if identity else ('#684267' if idx==0 else '#fff6db'),bold=idx==0))
 data['presets'][key]=dict(label=label,parts=parts,saveAs=identity)
preset('update-log',"What's new log",["WHAT'S NEW","Aug 12   Added a tape list.\nAug 09   The guestbook is open."])
preset('radio-grid',"Radio schedule",["ON THE DIAL","19:00   The request hour\n21:30   Signals after dark"])
preset('club-roll',"Club member roll",["MEMBER ROLL","01   TapeMouse / founder\n02   Junebug / button artist"])
preset('bbs-motd',"Message of the day",["MESSAGE OF THE DAY","Friday swap meet at 8 PM. Bring one text file to trade."],"bbs-bulletin")
preset('bbs-sysop',"Sysop hours",["SYSOP DESK","Handle: PATCH\nOn board: Fridays, 20:00"],"bbs-bulletin")
preset('bbs-map',"ASCII room map",["BOARD MAP","[LOBBY]---[FILES]\n   |\n[ARCADE]"],"bbs-art")
catalog=json.dumps(data,separators=(',',':'))
p.write_text(catalog+'\n');(w/'objects.js').write_text('window.retroObjects = '+catalog+';\n')
edit(d/'widgets.py','obj.update({k: v for k, v in part.items() if k not in ("dx", "dy")}, widget=key)','obj.update({k: v for k, v in part.items() if k not in ("dx", "dy")})\n        stored_widget = PRESETS[key].get("saveAs", key)\n        if stored_widget:\n            obj["widget"] = stored_widget')
edit(w/'app.js','...part,widget:key,','...part,')
edit(w/'app.js',"      if (key==='counter') o.src=",'''      const storedWidget = Object.hasOwn(spec,'saveAs') ? spec.saveAs : key;
      if (storedWidget) o.widget = storedWidget;
      if (key==='counter') o.src=''')
edit(w/'offline.js','0.4.2-3fa5c92825ef','0.4.3-'+hashlib.sha256(catalog.encode()).hexdigest()[:12])
pages=Path('work/github-pages')
edit(pages/'crawler/index.html',' <p class="try">',' <p><a id="gifcities" href="https://gifcities.org/" target="_blank" rel="noopener noreferrer">Search GifCities for GIFs</a></p>\n <p class="try">')
edit(pages/'crawler/grub.js','  function draw() {','''  function syncGifSearch() {
    var term = query.value.trim();
    $('gifcities').href = term ? 'https://gifcities.org/search?q='+encodeURIComponent(term) : 'https://gifcities.org/';
  }
  query.addEventListener('input',syncGifSearch);
  function draw() {
    syncGifSearch();''')
edit(pages/'crawler/grub.js','Searching the five original sites.','Searching the local site index.')
edit(pages/'crawler/index.html','Browse the five cards above','Browse the sites above')
for folder in [pages/'retropage',Path('work/retro-page-published')]:
 for name in ['app.js','objects.js','offline.js']:shutil.copy2(w/name,folder/name)
for p in [d/'app.py',d/'README.md',Path('work/desktop-packaging/build.py'),Path('work/winpkg/package.py'),Path('work/winpkg/launcher.rc'),pages/'desktop/index.html']:edit(p,'0.4.2','0.4.3')
edit('work/winpkg/launcher.rc','0,4,2,0','0,4,3,0')
with (d/'README.md').open('a') as f:f.write("\nThe Objects drawer also includes a What’s New log, radio schedule, and club member roll. BBS objects include a message of the day, sysop hours, and an editable ASCII room map.\n")
for name in ['app.py','README.md','widgets.py','assets/objects.json']:shutil.copy2(d/name,pages/'studio-desktop'/name)
