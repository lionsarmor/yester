from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import tkinter as tk
import json
import base64
import sys
import zipfile
from PIL import ImageGrab
sys.path.insert(0, str(Path('work/desktop-app').resolve()))
from app import Studio, read_project, validate_project
r = tk.Tk()
s = Studio(r)
r.geometry('1070x725+20+30')
r.update()
r.focus_force()
s.error = lambda message: (_ for _ in ()).throw(AssertionError(message))
validate_project(s.doc)
t = next(o for o in s.doc['items'] if o['kind']=='text')
s.canvas.select(t['id'])
r.update()
box=(r.winfo_rootx(),r.winfo_rooty(),r.winfo_rootx()+r.winfo_width(),r.winfo_rooty()+r.winfo_height())
if '--capture' in sys.argv:
    ImageGrab.grab(bbox=box).save('outputs/yestersites-studio.png')
s.edit(t['id'])
r.update()
s.inline.delete('1.0','end')
s.inline.insert('1.0','FROM THE ATTIC')
s.inline.event_generate('<Control-Return>')
r.update()
assert s.get(t['id'])['text']=='FROM THE ATTIC'
s.undo()
assert s.get(t['id'])['text']!='FROM THE ATTIC'
s.redo()
assert s.get(t['id'])['text']=='FROM THE ATTIC'
s.copy()
count=len(s.doc['items'])
s.paste()
assert len(s.doc['items'])==count+1
s.delete()
assert len(s.doc['items'])==count
t=s.get(t['id'])
s.edit(t['id']);r.update()
s.inline.insert('end',' STUDIOS')
with TemporaryDirectory() as folder:
    d=Path(folder)
    with patch('app.filedialog.asksaveasfilename',return_value=str(d/'attic.yst')):
        assert s.save()
    assert read_project(d/'attic.yst')['items'][1]['text']=='FROM THE ATTIC STUDIOS'
    with patch('app.filedialog.asksaveasfilename',return_value=str(d/'attic.zip')):
        s.export()
    with zipfile.ZipFile(d/'attic.zip') as z:
        assert 'text.html' in z.namelist() and b'FROM THE ATTIC STUDIOS' in z.read('index.html')
    with patch('app.webbrowser.open',return_value=True) as browser:
        s.preview()
        assert browser.call_args.args[0].endswith('/preview/index.html')
        s.doc['slug']='attic';s.commit();s.publish()
        assert browser.call_args.args[0].endswith('/publish.html')
        bridge=(Path(s.tmp.name)/'publish.html').read_text()
        draft=bridge.split('#draft=')[1].split('"')[0]
        assert json.loads(base64.urlsafe_b64decode(draft+'==='))['slug']=='attic'
s.close()
print('PASS: real Tk shell, editing, canvas, undo/redo, copy/paste, draft save, both exports, preview and publishing handoff.')
