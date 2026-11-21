#!/usr/bin/python3
"""Launch actual guest windows on private displays and retain screenshots and HTTPS receipts."""
import argparse
import concurrent.futures
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from PIL import ImageGrab
from launch import ROOT, LAB, HOST, MACHINES, member, member_origin, guest

XSERVER = ROOT / "work/winpkg/winecheck/sysroot/usr/bin/Xvfb"


def check(machine, site, root):
    folder = root / machine
    folder.mkdir(parents=True, exist_ok=False)
    pattern = {"win31":"DOSBox", "win98":"QEMU", "c64":"VICE", "x16":".", "next":"ZEsarUX"}[machine]
    with guest([XSERVER, "-displayfd", "1", "-screen", "0", "1200x1000x24", "-nolisten", "tcp", "-ac"],
               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True) as xserver:
        display = ":" + xserver.stdout.readline().strip()
        env = dict(os.environ, DISPLAY=display)
        tools = dict(env, LD_LIBRARY_PATH=str(HOST / "lib/x86_64-linux-gnu"))
        def xdo(*args, check=True):
            return subprocess.run([HOST / "bin/xdotool", *map(str,args)], env=tools, capture_output=True,
                                  text=True, check=check).stdout.strip()
        with (folder / "emulator.log").open("w") as log, guest(
                [sys.executable, LAB / "launch.py", machine, site, "--evidence", folder],
                env=env, cwd=LAB, stdout=log, stderr=subprocess.STDOUT) as proc:
            def receipts():
                if machine in ("c64", "next"):
                    path = folder / "requests.jsonl"
                    return [(r.get("status"), r.get("url")) for r in map(json.loads, path.read_text().splitlines())] if path.exists() else []
                path = folder / "requests.tsv"
                if not path.exists():
                    return []
                rows = [s.split("\t") for s in path.read_text().splitlines()]
                return [(int(r[0]), r[1] if machine=="x16" else r[-1]) for r in rows if len(r)>=3]
            def wait_for(predicate, seconds=80):
                until = time.monotonic() + seconds
                while time.monotonic() < until:
                    if proc.poll() is not None:
                        raise RuntimeError("emulator exited; see " + str(folder / "emulator.log"))
                    rows = receipts()
                    if predicate(rows):
                        return rows
                    time.sleep(.32)
                raise RuntimeError("guest request timed out. See " + str(folder))
            def capture(name):
                wins = xdo("search", "--onlyvisible", "--name", pattern, check=False).splitlines()
                if not wins:
                    wins = xdo("search", "--onlyvisible", "--name", ".", check=False).splitlines()
                candidates=[]
                for w in wins:
                    geom = dict(l.split("=",1) for l in xdo("getwindowgeometry","--shell",w).splitlines())
                    x,y,width,height=(int(geom[k]) for k in ("X","Y","WIDTH","HEIGHT"))
                    candidates.append((width*height,w,(x,y,x+width,y+height)))
                _,w,rect=max(candidates)
                ImageGrab.grab(bbox=rect,xdisplay=display).save(folder / (name + ".png"))
                xdo("windowfocus",w,check=False)
            origin = member_origin(site) + "/"
            wait_for(lambda rows:any(status==200 and url.startswith(origin) for status,url in rows), 250)
            if machine in ("win31","win98"):
                time.sleep(18 if machine=="win31" else 20)
            else:
                time.sleep(2)
            capture("home")
            if machine in ("c64","x16","next"):
                for key, name in [("1","first-screen"),("0","home-return")]:
                    before = len(receipts())
                    xdo("keydown", key)
                    time.sleep(.2)
                    xdo("keyup", key)
                    rows = wait_for(lambda rs:len(rs)>before, 65)
                    assert rows[-1][0] == 200 and rows[-1][1].startswith(origin)
                    if key=="1" and rows[-1][1]==rows[0][1]:
                        raise RuntimeError("Numbered BBS navigation did not leave the homepage")
                    if key=="0" and rows[-1][1]!=rows[0][1]:
                        raise RuntimeError("0 did not return to the homepage")
                    time.sleep(1.5)
                    capture(name)
            rows=receipts()
            print(machine, *[f"{s} {url}" for s,url in rows], sep="\n  ", flush=True)
            return rows


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=member)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("machines", nargs="*", default=list(MACHINES))
    args=parser.parse_args()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        fs={pool.submit(check,m,args.site,args.evidence.resolve()):m for m in args.machines}
        errors=[]
        for future in concurrent.futures.as_completed(fs):
            try:
                future.result()
            except Exception as err:
                errors.append(f"{fs[future]}: {err}")
                print(errors[-1], file=sys.stderr, flush=True)
        sys.exit(bool(errors))
