from pathlib import Path
import time,sys
drive=Path(__file__).resolve().parent/'drive'
def command(*parts):
 out=drive/'DRIVER.OUT';out.unlink(missing_ok=True);tmp=drive/'DRIVER.TMP';tmp.write_text('\t'.join(parts)+'\n',encoding='ascii');tmp.replace(drive/'DRIVER.IN')
 for i in range(250):
  if out.exists() and not (drive/'DRIVER.IN').exists():return out.read_text('latin1')
  time.sleep(.04)
 raise RuntimeError('Win16 driver command timed out')
if __name__=='__main__':print(command(*sys.argv[1:]))
