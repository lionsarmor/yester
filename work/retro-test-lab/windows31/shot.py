from pathlib import Path
from PIL import ImageGrab
import subprocess,re,sys,os
lab=Path(__file__).resolve().parent
env={**os.environ,'DISPLAY':(lab/'display').read_text()}
d=env['DISPLAY'];tree=subprocess.check_output(['xwininfo','-root','-tree'],env=env,text=True)
print(tree[:300])
m=re.search(r'"DOSBox[^"]*".*?\s(\d+)x(\d+)\+(-?\d+)\+(-?\d+)',tree,re.I)
if m:
 w,h,x,y=map(int,m.groups())
else:w,h,x,y=800,617,0,0
img=ImageGrab.grab(xdisplay=d).crop((x,y+h-600,x+w,y+h))
img.save(sys.argv[1] if len(sys.argv)>1 else lab/'current.png')
