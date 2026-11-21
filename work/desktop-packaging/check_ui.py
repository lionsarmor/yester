"""Launch the packaged GUI, make a project, re-open it and compare exported text."""
from pathlib import Path
import sys
import tempfile
import tkinter as tk
from zipfile import ZipFile

payload = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(payload))
from app import ART, ASSETS, Studio
from project import export_zip, read_project, save_project

with tempfile.TemporaryDirectory() as scratch:
    root = tk.Tk()
    studio = Studio(root)
    root.update_idletasks()
    assert all((ASSETS / asset).is_file() for asset, _ in ART)
    assert len(studio.thumbs) == len(ART)
    draft = Path(scratch) / "project with spaces.yst"
    save_project(draft, studio.doc)
    loaded = read_project(draft)
    studio.load(draft)
    assert studio.doc == loaded
    export_zip(Path(scratch) / "web.zip", loaded)
    with ZipFile(Path(scratch) / "web.zip") as archive:
        assert archive.testzip() is None
        assert {"text.html", "index.html"} <= set(archive.namelist())
        assert any(name.endswith(".jpg") for name in archive.namelist())
    root.destroy()
print(f"{payload.name} launches, loads all stamps, opens .yst and exports both editions")
