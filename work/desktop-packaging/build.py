"""Assemble the Retro Page Debian binary and portable source archives from one snapshot."""
import argparse
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


BASE = Path(__file__).resolve().parents[1]
SOURCE = BASE / "desktop-app"
VERSION = "0.14.1"

def app_files():
    yield SOURCE / "desktop_shell.py", Path("app.py")
    yield SOURCE / "desktop-window.js", Path("desktop-window.js")
    yield SOURCE / "assets/desktop-icon.png", Path("assets/desktop-icon.png")
    yield SOURCE / "README.md", Path("README.md")
    editor = BASE / "retro-page-web"
    for path in sorted(editor.rglob("*")):
        if path.is_file() and path.name not in {".git", ".nojekyll", "CNAME", "README.md"} and ".git" not in path.parts:
            yield path, Path("editor") / path.relative_to(editor)


LAUNCH = """#!/bin/sh
exec /usr/bin/python3 /usr/share/retro-page/app.py "$@"
"""
ENTRY = """[Desktop Entry]
Type=Application
Name=Retro Page
Comment=Make and publish old-school homepages
Exec=retro-page %f
Icon=retro-page
StartupWMClass=RetroPage
Terminal=false
Categories=Development;WebDevelopment;
MimeType=application/x-yestersites-project;
Keywords=homepage;HTML;web;editor;
"""
MIME = """<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-yestersites-project">
    <comment>Retro Page project</comment>
    <glob pattern="*.yst"/>
  </mime-type>
</mime-info>
"""
CONTROL = """Package: retro-page
Version: {version}
Architecture: all
Section: editors
Priority: optional
Conflicts: retro-pages (<< 0.3.0), yestersites-studio (<< 0.1.1)
Replaces: retro-pages (<< 0.3.0), yestersites-studio (<< 0.1.1)
Provides: retro-pages (= {version}), yestersites-studio (= {version})
Maintainer: Retro Page
Installed-Size: {size}
Depends: python3 (>= 3.9)
Recommends: www-browser
Homepage: https://yestersites.com/
Description: Desktop editor for old-school homepages
 Arrange and resize text, links and pictures, save editable local projects,
 export graphical and text HTML editions, and publish pages to YesterSites.
"""


def write_file(target, content, mode=0o644):
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    target.chmod(mode)


def build(destination):
    destination.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=destination) as temp:
        staging = Path(temp)
        deb = staging / "deb"
        app = deb / "usr/share/retro-page"
        doc = deb / "usr/share/doc/retro-page"
        doc.mkdir(parents=True)
        files = app_files()
        source_zip = staging / f"Retro-Page-{VERSION}-source.zip"
        with ZipFile(source_zip, "w", compression=ZIP_DEFLATED) as archive:
            for path, rel in files:
                data = path.read_bytes()
                entry = ZipInfo("Retro-Page/" + rel.as_posix(), (2026, 11, 20, 0, 0, 0))
                entry.compress_type = ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, data)
                target = (doc if rel.name in ("README.md", "requirements.txt") and len(rel.parts) == 1 else app) / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                target.chmod(0o644)
        write_file(deb / "usr/bin/retro-page", LAUNCH, 0o755)
        (deb / "usr/bin/yestersites-studio").symlink_to("retro-page")
        (deb / "usr/bin/retro-pages").symlink_to("retro-page")
        write_file(deb / "usr/share/applications/retro-page.desktop", ENTRY)
        write_file(deb / "usr/share/mime/packages/retro-page.xml", MIME)
        icon = deb / "usr/share/icons/hicolor/256x256/apps/retro-page.png"
        icon.parent.mkdir(parents=True)
        icon.write_bytes((app / "assets/desktop-icon.png").read_bytes())
        size = sum((p.stat().st_size + 1023) // 1024 for p in deb.rglob("*") if p.is_file())
        write_file(deb / "DEBIAN/control", CONTROL.format(version=VERSION, size=size))
        for path in deb.rglob("*"):
            if path.is_dir():
                path.chmod(0o755)
        package = staging / f"Retro-Page-{VERSION}-all.deb"
        subprocess.run(["dpkg-deb", "--root-owner-group", "--build", str(deb), str(package)],
                       check=True, env={**os.environ, "SOURCE_DATE_EPOCH": "1795132800"})
        source_zip.replace(destination / source_zip.name)
        package.replace(destination / package.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    build(parser.parse_args().destination.resolve())
