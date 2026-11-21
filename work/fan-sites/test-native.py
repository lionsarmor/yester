from pathlib import Path
import sys,time,tkinter as tk,base64,json
from urllib.request import urlopen
from unittest.mock import patch
sys.path.insert(0,str(Path('work/retro-page-0.4.3/usr/share/retro-page').resolve()))
from app import Studio
from project import read_project,save_project,export_zip,terminal_lines
from gifcities import BLOBS
from zipfile import ZipFile
root=tk.Tk();root.withdraw();app=Studio(root)
app.new()
for key in ['update-log','club-roll','radio-grid','bbs-motd','bbs-sysop','bbs-map']:
 app.insert(key,10,10)
assert any('BOARD MAP' in t for t in terminal_lines(app.doc,app.site)[0])
app.stamp_search.set('skullsmoke');app.open_gifcities()
until=time.monotonic()+75
while not app.remote_gifs.photos and time.monotonic()<until:
 root.update();time.sleep(.03)
assert app.remote_gifs.photos and app.remote_gifs.rows, [w.cget('text') for w in app.remote_gifs.winfo_children() if 'text' in w.keys()]
path=next(p for p in app.stamp_defaults if p.parent.name=='gifcities')
app.insert('image',40,30,path)
assert base64.b64decode(app.get()['src'].partition(',')[-1])==path.read_bytes()
with app.tmp as d:
 save_project(Path(d)/'test.yst',app.site);doc=read_project(Path(d)/'test.yst')
 export_zip(Path(d)/'site.zip',doc)
 with ZipFile(Path(d)/'site.zip') as z:assert any(name.endswith('.gif') and z.read(name)==path.read_bytes() for name in z.namelist())
root.destroy();print('Installed native app passed live inline search, placement, byte-identical GIF export and all six new presets.')
