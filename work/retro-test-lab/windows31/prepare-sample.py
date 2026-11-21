from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import sys
lab=Path(__file__).resolve().parent
sys.path.insert(0,str(lab.parents[1]/'desktop-app'))
from app import make_sample
from project import export_zip
def write_sample(target):
    target.mkdir(exist_ok=True,parents=True)
    with TemporaryDirectory() as scratch:
        bundle=Path(scratch)/'retro.zip'
        export_zip(bundle,make_sample())
        with ZipFile(bundle) as archive:
            for name in archive.namelist():
                if name.startswith('DOS/'):
                    (target/Path(name).name).write_bytes(archive.read(name))
if __name__=='__main__':write_sample(lab/'drive/WWW')
