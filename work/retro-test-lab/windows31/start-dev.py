from pathlib import Path
import subprocess,os
lab=Path(__file__).resolve().parent
root=Path('/home/roddy/Desktop/lionsarmor/BUDDY/.tools/emulators/root/usr')
env={**os.environ,'LD_LIBRARY_PATH':str(root/'lib/x86_64-linux-gnu'),'SDL_VIDEODRIVER':'x11','SDL_AUDIODRIVER':'dummy','XDG_DATA_DIRS':'/usr/local/share:/usr/share'}
x=subprocess.Popen([str(root/'bin/Xvfb'),'-displayfd','1','-screen','0','1000x800x24','-nolisten','tcp'],stdout=subprocess.PIPE,stderr=(lab/'x.log').open('w'),text=True,env=env)
env['DISPLAY']=':'+x.stdout.readline().strip();(lab/'display').write_text(env['DISPLAY']);(lab/'x.pid').write_text(str(x.pid))
cfg=lab/'lab.conf';cfg.write_text(f"""[sdl]
fullscreen=false
output=surface
autolock=false
[dosbox]
machine=svga_s3
memsize=32
[cpu]
core=normal
cycles=30000
[autoexec]
mount c "{lab/'drive'}"
c:
path c:\\windows
cd windows
win /3 c:\\driver.exe
exit
""")
env['LD_LIBRARY_PATH']=str(lab/'runtime/usr/lib/x86_64-linux-gnu')
env['XDG_DATA_DIRS']=str(lab/'runtime/usr/share')+':/usr/local/share:/usr/share'
p=subprocess.Popen([str(lab/'runtime/usr/bin/dosbox-x'),'-conf',str(cfg)],cwd=lab,env=env,stdout=(lab/'dosbox.log').open('w'),stderr=subprocess.STDOUT)
(lab/'dosbox.pid').write_text(str(p.pid))
try:p.wait()
finally:x.terminate()
