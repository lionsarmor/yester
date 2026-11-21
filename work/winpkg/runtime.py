from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests,hashlib,tarfile,zipfile
dest=Path(__file__).resolve().parent
def get_archive():
 data=requests.get('https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/20261110',timeout=30);data.raise_for_status()
 name='cpython-3.13.18+20261110-x86_64-pc-windows-msvc-install_only_stripped.tar.gz'
 asset=next(a for a in data.json()['assets'] if a['name']==name)
 return (asset['browser_download_url'],name,asset['digest'].split(':')[-1])
def get_wheel():
 data=requests.get('https://pypi.org/pypi/pillow/json',timeout=30);data.raise_for_status()
 asset=next(a for a in data.json()['urls'] if '-cp313-cp313-win_amd64.whl' in a['filename'])
 return (asset['url'],asset['filename'],asset['digests']['sha256'])
def fetch(f):
 url,name,sha=f();file=dest/name
 if not file.exists():
  r=requests.get(url,timeout=120);r.raise_for_status();file.write_bytes(r.content)
 assert hashlib.sha256(file.read_bytes()).hexdigest()==sha
 print(name,file.stat().st_size,sha,flush=True)
 return file
with ThreadPoolExecutor() as pool: archive,wheel=pool.map(fetch,[get_archive,get_wheel])
with tarfile.open(archive) as t:
 print([i for i in t.getnames() if any(s in i for s in ('_tkinter.pyd','tk86t.dll','tk.tcl','init.tcl','pythonw.exe','license.tcl','vcruntime140.dll'))],flush=True)
 t.extractall(dest/'staging',filter='data')
with zipfile.ZipFile(wheel) as z:z.extractall(dest/'staging/python/Lib/site-packages')
