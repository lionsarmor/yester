"""Package a self-contained Retro Page for Windows x64."""
from pathlib import Path
import shutil
import sys
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base.parent / "desktop-packaging"))
from build import VERSION, app_files
out = base.parent.parent / "outputs/downloads"
out.mkdir(exist_ok=True)
launcher = base / "Retro Page.exe"
artifacts = list(app_files())
runtime = base / "staging/python"
ignored = shutil.ignore_patterns(
    "__pycache__", "*.pyc", "*.pdb", "pip", "pip-*.dist-info", "ensurepip",
    "PIL", "pillow*.dist-info", "test", "tests", "idlelib", "include", "libs", "Scripts",
)
readme = f"""Retro Page {VERSION} for Windows x64

Extract the entire ZIP to a folder and double-click Retro Page.exe.
Drop a .yst project onto the launcher to open it. Keep the runtime and
studio folders beside the launcher. The editor uses Edge, Chrome or Brave
for its desktop window, or the default browser when those are unavailable.
Open, save, preview and export local projects offline. Publishing and
online media searches need an internet connection. See studio/README.md.

Includes CPython 3.13.18 (Astral python-build-standalone 20261110) and
Tcl/Tk. Their license files are included in the runtime directory.
"""

with TemporaryDirectory(dir=base) as scratch:
    staging = Path(scratch)
    package = staging / "Retro Page"
    shutil.copytree(runtime, package / "runtime", ignore=ignored)
    shutil.copy2(launcher, package / launcher.name)
    for path, rel in artifacts:
        target = package / "studio" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    (package / "Read me.txt").write_text(readme, encoding="utf-8", newline="\r\n")
    zipped = staging / f"Retro-Page-{VERSION}-Windows-x64.zip"
    with ZipFile(zipped, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for file in sorted(package.rglob("*")):
            if file.is_file():
                archive.write(file, file.relative_to(staging))
    with ZipFile(zipped) as archive:
        assert archive.testzip() is None
        assert archive.read("Retro Page/Retro Page.exe") == launcher.read_bytes()
        for path, rel in artifacts:
            assert archive.read("Retro Page/studio/" + rel.as_posix()) == path.read_bytes()
        for entry in ("pythonw.exe", "python313.dll", "DLLs/_tkinter.pyd", "tcl/tcl8.6/init.tcl"):
            assert "Retro Page/runtime/" + entry in archive.namelist()
    dest = out / zipped.name
    zipped.replace(dest)
    print(f"{dest.name} contains {len(artifacts)} verified studio files, {dest.stat().st_size:,} bytes")
