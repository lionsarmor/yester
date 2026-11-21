from pathlib import Path
from Xlib import display,X,XK
from Xlib.ext import xtest
import os,sys,time,re,subprocess
lab=Path(__file__).resolve().parent
d=display.Display((lab/'display').read_text());root=d.screen().root
def key(k,shift=False):
 keycode=d.keysym_to_keycode(XK.string_to_keysym(k))
 if not keycode:raise ValueError(k)
 if shift:xtest.fake_input(d,X.KeyPress,d.keysym_to_keycode(XK.string_to_keysym('Shift_L')))
 xtest.fake_input(d,X.KeyPress,keycode);xtest.fake_input(d,X.KeyRelease,keycode)
 if shift:xtest.fake_input(d,X.KeyRelease,d.keysym_to_keycode(XK.string_to_keysym('Shift_L')))
 d.sync();time.sleep(.04)
def click(x,y):
 tree=subprocess.check_output(['xwininfo','-root','-tree'],env={**os.environ,'DISPLAY':(lab/'display').read_text()},text=True)
 m=re.search(r'"DOSBox[^"]*".*?\s(\d+)x(\d+)\+(-?\d+)\+(-?\d+)',tree,re.I)
 w,h,x0,y0=map(int,m.groups());x=x+x0;y=y+y0+h-600
 xtest.fake_input(d,X.MotionNotify,x=x,y=y);d.sync();time.sleep(.15)
 xtest.fake_input(d,X.ButtonPress,1);d.sync();time.sleep(.05);xtest.fake_input(d,X.ButtonRelease,1);d.sync()
if sys.argv[1]=='click':click(int(sys.argv[2]),int(sys.argv[3]))
elif sys.argv[1]=='type':
 for c in sys.argv[2]:
  sym={' ':'space','/':'slash','\\':'backslash',':':'semicolon','.':'period','|':'backslash'}.get(c,c.lower())
  key(sym,c.isupper() or c in ':|')
else:
 for sym in sys.argv[1:]:key(sym)
