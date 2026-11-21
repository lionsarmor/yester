from pathlib import Path
import base64
import sys
import tkinter as tk
sys.path.insert(0, str(Path('work/desktop-app').resolve()))
from layout_canvas import DesignCanvas, MARGIN
root = tk.Tk()
root.geometry("610x390+2200+1500")
selected=[]; changes=[]; edited=[]
canvas=DesignCanvas(root,selected.append,lambda:changes.append(True),edited.append)
canvas.pack(fill='both',expand=True)
data=base64.b64encode(Path('outputs/assets/ring.gif').read_bytes()).decode()
items = [
    dict(id='box',kind='box',x=50,y=80,w=100,h=60,color='#000000',fill='#cccccc'),
    dict(id='text',kind='text',text='Title',x=60,y=90,w=60,h=20,color='navy'),
    dict(id='image',kind='image',src='data:image/gif;base64,'+data,x=270,y=35,w=88,h=31)
]
canvas.set_scene(items,800,720,'ivory')
root.update()
assert len(canvas._photos)==1
cv=canvas.canvas
# Simulate an actual drag on the uppermost object at an overlap.
def evt(name,x,y,t):
    cv.event_generate(name,x=int(x-22+MARGIN),y=int(y-22+MARGIN),time=t); root.update()
evt('<ButtonPress-1>',90,119,1000)
assert canvas.selected=='text' and selected==['text']
evt('<B1-Motion>',106,139,1100); evt('<ButtonRelease-1>',106,139,1300)
assert (items[1]['x'],items[1]['y']) == (76,110)
assert len(changes)==1
# Resize via lower right handle; verify shared document mutation, one callback.
evt('<ButtonPress-1>',158,152,2200)
evt('<B1-Motion>',178,170,2300); evt('<ButtonRelease-1>',178,170,2450)
assert (items[1]['w'],items[1]['h'])==(80,38),items[1]
assert len(changes)==2
# A return to the initial position/cancel must not mark the document dirty.
evt('<ButtonPress-1>',122,142,3400)
evt('<B1-Motion>',150,180,3500)
canvas._cancel(None); root.update()
assert (items[1]['x'],items[1]['y'])==(76,110) and len(changes)==2
# Button-style placement and palette drag hotspot use the same snapped paper space.
canvas.set_snap(True); placed=[]
canvas.set_placement(lambda x,y: placed.append((x,y)))
evt('<ButtonPress-1>',67,67,4400)
assert placed==[(48,48)]
assert canvas.point_at_screen(cv.winfo_rootx()+45+MARGIN,cv.winfo_rooty()+45+MARGIN)==(48,48)
assert canvas.point_at_screen(0,0) is None
canvas.set_snap(False)
canvas._nudge(type('Event',(),dict(keysym='Down',state=1))())
assert items[1]['y']==120 and len(changes)==3
canvas.set_zoom(.5); canvas.set_grid(True); root.update()
assert canvas.point_at_screen(cv.winfo_rootx()+20+MARGIN,cv.winfo_rooty()+20+MARGIN)==(40,40)
canvas.set_zoom(1); root.update();cv.xview_scroll(100,'units'); root.update()
assert canvas.point_at_screen(cv.winfo_rootx()+MARGIN,cv.winfo_rooty()+MARGIN)==(100,0)
canvas.select('image');canvas._keyboard_edit(None);assert edited==['image']
root.destroy()
print('Native X11 Tk passed: GIF decode, stacking selection, dragging, resize handles, cancellation, placement, snapping, keyboard nudge, zoom and scrolling, edit callback.')
