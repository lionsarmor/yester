from pathlib import Path
from unittest.mock import patch
import sys,tkinter as tk,zipfile,shutil
sys.path.insert(0,str(Path('work/desktop-app').resolve()))
from app import Studio
root=tk.Tk();root.withdraw();studio=Studio(root)
punct=str.maketrans({'’':"'",'‘':"'",'“':'"','”':'"','–':'-','—':'-'})
for slug in ['moon-relay','player-two']:
 out=Path('outputs/fan-sites');folder=Path('work/github-pages')/slug;path=out/(slug+'.yst')
 studio.load(path)
 for ident,page in studio.page_entries():
  studio.switch_page(ident)
  for obj in page['items']:
   change={}
   if obj['text']!=obj['text'].translate(punct):change['text']=obj['text'].translate(punct)
   if obj['text']=='The midnight\nswitchboard':change.update(h=58,font_size=20)
   if change:studio.apply_object(obj,change)
 studio.switch_page('home');assert studio.save()
 with patch('app.filedialog.asksaveasfilename',return_value=str(out/(slug+'.zip'))):studio.export()
 with zipfile.ZipFile(out/(slug+'.zip')) as z:z.extractall(folder)
 shutil.copy2(path,folder/path.name)
root.destroy()
