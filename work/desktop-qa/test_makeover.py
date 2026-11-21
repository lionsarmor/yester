import base64
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import tkinter as tk
from unittest.mock import patch
from zipfile import ZipFile
from PIL import ImageGrab
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(sys.argv[1] if len(sys.argv)>1 else 'work/desktop-app').resolve()))
from app import Studio
from project import new_item, new_project, page_filename, read_project, validate_site

root = tk.Tk(className='RetroPages')
studio = Studio(root)
root.geometry("1184x670+65+75")
root.update()
root.lift()
root.focus_force()
root.update()
assert tuple(studio.page_list.item(key, 'text') for key in studio.page_list.get_children()) == ('Home','Station Log','Links')
assert studio.get()['text'] == 'Radio tower at night'
studio.switch_view('source')
assert 'LATE NIGHT' in studio.source_view.get('1.0', 'end')
studio.switch_view('design')
root.update()
headline = next(item for item in studio.doc['items'] if item['text'] == 'LATE NIGHT\nSIGNAL')
assert any(key[0] == headline['id'] for key in studio.canvas._photos)

if '--capture' in sys.argv:
    root.after(300, root.quit)
    root.mainloop()
    root.update()
    x,y=root.winfo_rootx(),root.winfo_rooty()
    ImageGrab.grab(bbox=(x-4,y-52,x+root.winfo_width()+4,y+root.winfo_height()+4)).save('outputs/Retro-Pages-app.png')
studio.error = lambda e: (_ for _ in ()).throw(AssertionError(str(e)))
tower = studio.get()
old_x, old_y, old_width = tower["x"], tower["y"], tower["w"]
cv=studio.canvas.canvas
for event,x,y,when in [('<ButtonPress-1>',old_x+40,old_y+48,1200),('<B1-Motion>',old_x+56,old_y+58,1400),('<ButtonRelease-1>',old_x+56,old_y+58,1650)]:
    cv.event_generate(event,x=x,y=y,time=when)
    root.update()
assert (tower["x"],tower["y"]) == (old_x+16, old_y+10)
studio.fields["w"].set("240")
studio.apply_inspector()
assert studio.get()["w"] == 240
studio.undo()
assert studio.get()["w"] == old_width
studio.redo()
assert studio.get()["w"] == 240
studio.layer(1)
assert studio.doc["items"][-1]["id"] == tower["id"]
studio.bbs_input.insert(0,'1')
studio.bbs_command()
assert studio.bbs_text.get("1.0","end").startswith('STATION LOG')
studio.bbs_input.insert(0,'h')
studio.bbs_command()
assert studio.bbs_text.get("1.0","end").startswith('LATE NIGHT SIGNAL')
assert all(len(l)<=32 for l in studio.bbs_text.get("1.0","end").splitlines())
text = next(o for o in studio.doc['items'] if o['kind']=='text')
studio.canvas.select(text['id'])
studio.edit(text["id"])
root.update()
studio.inline.insert('end',' FM')
studio.finish_edit()
assert studio.get()['text'].endswith('FM')

with TemporaryDirectory() as d:
    def picked(value):
        return patch('app.filedialog.asksaveasfilename',return_value=str(Path(d)/value))
    with patch('app.simpledialog.askstring',return_value='Equipment'):
        studio.add_page()
    equipment = studio.active_page
    assert studio.doc['title']=='Equipment'
    with patch.object(studio,'_form') as form:
        studio.insert('link',20,20)
        title, fields, values, apply = form.call_args.args
        apply({'target':'1. Home'})
    assert studio.get()['href']=='page:home'
    studio.switch_page('home')
    with patch.object(studio,'_form') as form:
        studio.insert('link',25,415)
        link_id=studio.get()['id']
        _, _, _, apply = form.call_args.args
        apply({'target':'4. Equipment'})
    studio.switch_page(equipment)
    with patch('app.simpledialog.askstring',return_value='Receiver Notes'):
        studio.rename_page()
    with picked('signal.yst'):
        assert studio.save()
    with picked('signal.zip'):
        studio.export()
    with ZipFile(Path(d)/'signal.zip') as z:
        for text in (False, True):
            home=BeautifulSoup(z.read(page_filename('home',text)), 'html.parser')
            dest=page_filename(equipment,text)
            assert home.find('a',href=dest)
            other=BeautifulSoup(z.read(dest),'html.parser')
            assert other.title.text=='Receiver Notes' and other.find('a',href=page_filename('home',text))
    with patch('app.webbrowser.open') as launch:
        studio.preview()
        assert launch.call_args.args[0].endswith(page_filename(equipment))
    studio.load(Path(d)/'signal.yst')
    assert studio.get(link_id)['href']=='page:'+equipment
    studio.switch_page(equipment)
    with patch('app.messagebox.askyesno',return_value=True):
        studio.delete_page()
    assert not studio.get(link_id)['href']
    studio.undo()
    validate_site(studio.site)
    assert studio.get(link_id)['href']=='page:'+equipment

    legacy = new_project()
    legacy.update(slug='oldhome',title='Old Home')
    legacy['items'].append(new_item('text'))
    old_file=Path(d)/'old.yst'
    old_file.write_text(json.dumps(legacy))
    studio.load(old_file)
    assert len(studio.page_entries())==1 and read_project(old_file)==legacy
    with patch('app.webbrowser.open') as launch:
        studio.publish()
        assert launch.call_args.args[0].endswith('/publish.html')
        payload=(Path(studio.tmp.name)/'publish.html').read_text().split('#draft=',1)[1].split('"',1)[0]
        assert json.loads(base64.urlsafe_b64decode(payload+'==='))==legacy
studio.tmp.cleanup()
root.destroy()
print('Passed: GUI dragging, inspector, layering, inline typing, undo/redo, BBS navigation, page creation and renamed links in both exports, deletion undo, legacy .yst and single-page publishing handoff.')
