from pathlib import Path
from shutil import copy2
w=Path('work/retro-page-web')
p=w/'app.js';s=p.read_text()
a=s.index("      const archiveLink =");b=s.index('      if(!artReady)',a)
s=s[:a]+s[b:]
a=s.index('      root.append(collection, s, archiveLink, content);');b=a+len('      root.append(collection, s, archiveLink, content);')
s=s[:a]+'''      const archiveButton=node('button', 'gifcities-link', 'Search GifCities');
      archiveButton.type='button';
      const remote=node('div'), lookup=GifCities.panel(remote, async (item, current) => {
        const response=await fetch(item.url,{credentials:'omit',signal:AbortSignal.timeout(30000)});
        if(!response.ok) throw Error('This GIF could not be loaded.');
        if(Number(response.headers.get('Content-Length'))>98304) throw Error('This GIF exceeds the 96 KiB image limit.');
        const src=await M.readImage(await response.blob());
        M.imageType(src);
        await M.dimensions(src);
        if(current()) place({kind:'image',src,label:item.name,alt:item.name});
      });
      function searchArchive(){
        content.hidden=true;
        remote.hidden=false;
        lookup.search(s.value);
      }
      function showLocal(){
        lookup.clear();remote.hidden=true;content.hidden=false;
      }
      archiveButton.onclick=searchArchive;
      s.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();searchArchive();}};
      root.append(collection,s,archiveButton,remote,content);'''+s[b:]
s=s.replace('artGroup=collection.value;artPage=0;', 'showLocal();artGroup=collection.value;artPage=0;')
s=s.replace('filter=s.value;updateArchiveLink();','showLocal();filter=s.value;')
p.write_text(s)
p=w/'index.html';s=p.read_text().replace('    <script defer src="./app.js">','    <script defer src="./gifcities.js"></script>\n    <script defer src="./app.js">');p.write_text(s)
p=w/'offline.js';p.write_text(p.read_text().replace("  './app.js',","  './app.js',\n  './gifcities.js',"))
pages=Path('work/github-pages')
p=pages/'crawler/index.html';s=p.read_text().replace('<a id="gifcities" href="https://gifcities.org/" target="_blank" rel="noopener noreferrer">Search GifCities for GIFs</a>','<button type="button" id="gifcities">Find GIFs on GifCities</button>').replace('</form>','</form>\n<div id="gif-matches" aria-live="polite"></div>').replace('<script src="grub.js">','<script src="../retropage/gifcities.js"></script><script src="grub.js">');p.write_text(s)
p=pages/'crawler/grub.js';s=p.read_text();a=s.index('  function syncGifSearch');b=s.index('    var raw =',a)
s=s[:a]+'''  var gifPanel = window.GifCities.panel($('gif-matches'));
  $('gifcities').onclick = function () { gifPanel.search(query.value); };
  query.addEventListener('input',gifPanel.clear);
  function draw() {
'''+s[b:]
s=s.replace('event.preventDefault(); updateSearch();','event.preventDefault(); gifPanel.clear(); updateSearch();').replace('the five original member sites','the local site index');p.write_text(s)
p=pages/'crawler/grub.css';p.write_text(p.read_text()+'''
#gif-matches .stamp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:4px; }
#gif-matches .stamp { min-width:0; word-break:break-word; }
#gif-matches .stamp img { display:block; margin:auto; max-width:100%; height:48px; object-fit:contain; }
#gif-matches .art-pager { display:flex; gap:1em; align-items:center; margin-bottom:4px; }
''')
for folder in [pages/'retropage',Path('work/retro-page-published')]:
 for name in ('app.js','index.html','gifcities.js','offline.js'):copy2(w/name,folder/name)
