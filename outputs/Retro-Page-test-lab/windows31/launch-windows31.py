#!/usr/bin/env python3
"""Read a live YesterSites member or a local DOS edition in Windows 3.1."""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
import threading
from urllib.request import urlopen
from contextlib import ExitStack

from legacy_gateway import DEFAULT_SITE, Gateway, member_origin
from pathlib import Path


HERE = Path(__file__).resolve().parent
LAB = next((root / "work/retro-test-lab/windows31" for root in HERE.parents
            if (root / "work/retro-test-lab/windows31").is_dir()), HERE)
DEFAULT_GUEST = Path.home() / "Desktop/lionsarmor/BUDDY/build/retro-messenger/native/windows-3x/drive"
MEDIA = {
    "mosaic1.0.zip": "d725df714b88a7ac9f1ad45973b33d280137c0374fa8c617cc0f735322706683",
    "twsk20b.zip": "e6322e8c4b492660a84d8f5543c451909d9043cee0a152aea0c620286ff2433c",
    "mozock.zip": "dc917a0004773c8b716be18a150cd10c89138dfbfc29e1ffbc769de1fac3d6f7",
}


def approved_archive(name, media_dir):
    path = media_dir / name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != MEDIA[name]:
        raise SystemExit(f"Place the verified {name} in {media_dir}. See README.md for its origin.")
    return zipfile.ZipFile(path)


def packet_driver(path):
    expected = "69573724d30a9498f2a81d3b0ca9b79b4a326522d8aa43d111f7a9ddf047bc12"
    if path and path.is_file():
        data = path.read_bytes()
    elif path:
        raise SystemExit(f"Packet driver not found at {path}")
    else:
        source = ("https://raw.githubusercontent.com/joncampbell123/dosbox-x/"
                  "65529a66f6c360e736a4b07c729d7978a14118b9/src/builtin/ne2000bin.cpp")
        with urlopen(source, timeout=20) as response:
            array = response.read(1024 * 1024).decode("ascii").split("bin_ne2000_com[] = {", 1)[1].split("};", 1)[0]
        data = bytes.fromhex(" ".join(re.findall(r"0x([a-fA-F0-9]{2})", array)))
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit("Unexpected DOSBox-X packet-driver checksum.")
    return data


def stage_pages(source, target):
    target.mkdir()
    if source.is_dir():
        directory = source / "DOS" if (source / "DOS").is_dir() else source
        pages = {p.name: p.read_bytes() for p in directory.iterdir() if p.is_file()}
    else:
        with zipfile.ZipFile(source) as z:
            pages = {name[4:]: z.read(name) for name in z.namelist()
                     if name.startswith("DOS/") and not name.endswith("/")}
    if "INDEX.HTM" not in pages:
        raise SystemExit("Select a Retro Page ZIP or DOS directory containing INDEX.HTM.")
    for name, data in pages.items():
        if not re.fullmatch(r"[A-Z0-9_]{1,8}\.[A-Z0-9]{1,3}", name):
            raise SystemExit(f"The DOS edition contains a non-8.3 filename: {name}")
        (target / name).write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", nargs="?", default=DEFAULT_SITE,
                        help="YesterSites member name, exported ZIP, or DOS edition directory")
    parser.add_argument("--media-dir", type=Path, default=LAB, help="directory with Mosaic and Winsock archives")
    parser.add_argument("--packet-driver", type=Path, help="path to the DOSBox-X NE2000 packet driver")
    parser.add_argument("--request-log", type=Path, help="record upstream request results for compatibility tests")
    parser.add_argument("--guest", type=Path, default=DEFAULT_GUEST)
    parser.add_argument("--dosbox", type=Path)
    args = parser.parse_args()
    if not (args.guest / "WINDOWS" / "WIN.COM").is_file():
        raise SystemExit(f"Windows 3.1 files were not found in {args.guest}. Pass --guest with your installed drive.")
    system_dosbox = shutil.which("dosbox-x")
    runtime = LAB / "runtime/usr"
    dosbox = args.dosbox or (Path(system_dosbox) if system_dosbox else runtime / "bin/dosbox-x")
    if not dosbox.is_file():
        raise SystemExit("Install DOSBox-X or pass --dosbox with its executable.")
    env = dict(os.environ)
    if dosbox.resolve() == (runtime / "bin/dosbox-x").resolve():
        env["LD_LIBRARY_PATH"] = str(runtime / "lib/x86_64-linux-gnu")
        env["XDG_DATA_DIRS"] = str(runtime / "share") + ":" + env.get("XDG_DATA_DIRS", "/usr/local/share:/usr/share")
    offline = Path(args.site).exists()
    if not offline:
        if Path(args.site).suffix or '/' in args.site:
            raise SystemExit("Export file not found: " + args.site)
        member_origin(args.site)

    with ExitStack() as stack:
        scratch = stack.enter_context(tempfile.TemporaryDirectory(prefix="retro-pages-win31-"))
        temp = Path(scratch)
        drive = temp / "drive"
        shutil.copytree(args.guest, drive, ignore=shutil.ignore_patterns("BUDDY", "DRIVER.*", "*.o"))
        app = drive / "MOSAIC"
        app.mkdir(exist_ok=True)
        with approved_archive("mosaic1.0.zip", args.media_dir) as z:
            (app / "MOSAIC.EXE").write_bytes(z.read("MOSAIC.EXE"))
            ini = z.read("MOSAIC.INI").decode("latin1").splitlines()
        if offline:
            with approved_archive("mozock.zip", args.media_dir) as z:
                (app / "WINSOCK.DLL").write_bytes(z.read("MOZOCK.DLL"))
            stage_pages(Path(args.site), drive / "WWW")
            home = "file:///c|/WWW/INDEX.HTM"
            network, boot = "", ""
        else:
            with approved_archive("twsk20b.zip", args.media_dir) as z:
                for name in ("TCPMAN.EXE", "WINSOCK.DLL", "WINPKT.COM", "SERVICES", "PROTOCOL"):
                    (app / name).write_bytes(z.read(name))
            local_driver = args.media_dir / "NE2000.COM"
            driver = args.packet_driver or (local_driver if local_driver.is_file() else None)
            (app / "NE2000.COM").write_bytes(packet_driver(driver))
            host = args.site + ".yestersites.com"
            trumpet = ("[Trumpet Winsock]\r\nip=10.0.2.15\r\nnetmask=255.255.255.0\r\ngateway=10.0.2.2\r\n"
                       "dns=10.0.2.3\r\nvector=60\r\nslip-enabled=0\r\nslip-notify=0\r\ndial-option=0\r\n"
                       "ppp-enabled=0\r\nmtu=1500\r\nmss=1460\r\nrwin=5840\r\n")
            for folder in (drive / "WINDOWS", app):
                (folder / "TRUMPWSK.INI").write_bytes(trumpet.encode("ascii"))
                (folder / "HOSTS").write_bytes(("127.0.0.1 localhost\r\n10.0.2.2 " + host + "\r\n").encode("ascii"))
            stream = stack.enter_context(args.request_log.open("a", buffering=1)) if args.request_log else None
            def report(url, code, mime, size):
                if stream:
                    print(code, mime, size, url, sep="\t", file=stream)
            try:
                gateway = Gateway(args.site, 80, report)
            except OSError:
                gateway = Gateway(args.site, 0, report)
            stack.enter_context(gateway)
            threading.Thread(target=gateway.serve_forever, daemon=True).start()
            stack.callback(gateway.shutdown)
            home = "http://" + host + ("" if gateway.server_port == 80 else ":" + str(gateway.server_port)) + "/INDEX.HTM"
            network = "[ne2000]\nne2000=true\nnicbase=300\nnicirq=3\nbackend=slirp\n"
            boot = "c:\\mosaic\\ne2000 0x60 3 0x300\nc:\\mosaic\\winpkt 0x60\n"
            print("Opening " + home, flush=True)
        settings = {"Autoload Home Page": "yes", "Home Page": home}
        section = ""
        for i, line in enumerate(ini):
            if line.startswith("["):
                section = line
            key = line.partition("=")[0]
            if key in settings:
                ini[i] = key + "=" + settings[key]
            if section == "[Main Window]" and key in ("x", "y", "width", "height"):
                ini[i] = key + "=" + {"x":"0","y":"0","width":"798","height":"597"}[key]
        ini_data = ("\r\n".join(ini) + "\r\n").encode("latin1")
        for folder in (app, drive / "WINDOWS"):
            (folder / "MOSAIC.INI").write_bytes(ini_data)
        conf = temp / "retro.conf"
        conf.write_text(
            "[sdl]\nfullscreen=false\noutput=surface\nautolock=false\n"
            "[dosbox]\nmachine=svga_s3\nmemsize=32\n[cpu]\ncore=normal\ncycles=30000\n"
            f'{network}[autoexec]\nmount c "{drive}"\nc:\npath c:\\mosaic;c:\\windows;z:\\system;z:\\bin;z:\\\n{boot}cd mosaic\n'
            "win /3 c:\\mosaic\\mosaic.exe\nexit\n"
        )
        return subprocess.run([str(dosbox), "-conf", str(conf)], cwd=temp, env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main())
