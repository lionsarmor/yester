from pathlib import Path
import json,os,socket,sys,time
from PIL import Image
base=Path(__file__).resolve().parent
ipc=Path(os.environ.get('RETRO_PAGE_WIN98_QMP', Path(os.environ.get('XDG_RUNTIME_DIR','/tmp'))/'retro-page-win98.qmp'))
def command(name,args=None):
 with socket.socket(socket.AF_UNIX) as sock:
  sock.connect(str(ipc))
  with sock.makefile('rwb',buffering=0) as stream:
   stream.readline()
   def call(method,params):
    stream.write(json.dumps({'execute':method,'arguments':params}).encode()+b'\n')
    while True:
     response=json.loads(stream.readline())
     if 'return' in response:return response['return']
     if 'error' in response:raise RuntimeError(response['error'])
   call('qmp_capabilities',{})
   return call(name,args or {})
def key(keycode):
 command('human-monitor-command',{'command-line':'sendkey '+keycode})
def type_text(value):
 keys={':':'shift-semicolon','\\':'backslash','.':'dot','/':'slash',' ':'spc','-':'minus','_':'shift-minus','=':'equal','@':'shift-2'}
 for char in value:
  key(keys.get(char,'shift-'+char.lower() if char.isupper() else char));time.sleep(.09)
def shot(target):
 p=base/'screen.ppm';command('screendump',{'filename':str(p)})
 with Image.open(p) as im:im.save(target)
if sys.argv[1]=='shot':shot(sys.argv[2])
elif sys.argv[1]=='text':type_text(sys.argv[2])
elif sys.argv[1]=='key':
 for k in sys.argv[2:]:key(k);time.sleep(.23)

elif sys.argv[1]=='stop':command('quit')
