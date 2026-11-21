"""Verify a new loopback connection and real guest keyboard journeys through SwiftLink."""

import os
from pathlib import Path
import sys
import subprocess
import time
import json
import signal
from PIL import ImageGrab

HERE = Path(__file__).resolve().parent
base = HERE.parents[2]
out = base / "outputs/Retro-Page-test-lab/8bit"
sys.path.insert(0, str(out))
from launch import HOST

evidence = out / "evidence"
log = evidence / "c64-serial.jsonl"
log.unlink(missing_ok=True)
env = {**os.environ, "LD_LIBRARY_PATH": str(HOST / "usr/lib/x86_64-linux-gnu")}
xv = base / "work/winpkg/winecheck/sysroot/usr/bin/Xvfb"
with subprocess.Popen(
    [xv, "-displayfd", "1", "-screen", "0", "1024x800x24", "-nolisten", "tcp", "-ac"],
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
) as server:
    display = ":" + server.stdout.readline().strip()
    env["DISPLAY"] = display
    with (HERE / "logs/c64-serial.log").open("w") as console:
        app = subprocess.Popen(
            [sys.executable, out / "c64-gateway.py", "--log", log],
            env=env,
            stdout=console,
            stderr=console,
            start_new_session=True,
        )

        def xdo(*a):
            return subprocess.check_output(
                [HOST / "usr/bin/xdotool", *a], env=env, text=True
            ).strip()

        def waitfor(count):
            for _ in range(80):
                if app.poll() is not None:
                    break
                results = (
                    [json.loads(line) for line in log.read_text().splitlines()]
                    if log.exists()
                    else []
                )
                if len(results) >= count:
                    return results[-1]
                time.sleep(0.2)
            raise RuntimeError("No matching serial response. See logs/c64-serial.log")

        try:
            assert waitfor(1)["title"] == "LATE NIGHT SIGNAL"
            win = xdo("search", "--onlyvisible", "--name", "VICE").splitlines()[-1]
            xdo("windowfocus", win)
            g = dict(
                l.split("=", 1)
                for l in xdo("getwindowgeometry", "--shell", win).splitlines()
            )
            x, y, w, h = (int(g[f]) for f in ("X", "Y", "WIDTH", "HEIGHT"))

            def save(n):
                ImageGrab.grab(bbox=(x, y, x + w, y + h), xdisplay=display).save(
                    evidence / ("c64-serial-" + n + ".png")
                )

            save("home")
            for n, (key, title, name) in enumerate(
                [
                    ("1", "STATION LOG", "station-log"),
                    ("h", "LATE NIGHT SIGNAL", "home-return"),
                    ("2", "LINKS", "links"),
                ],
                2,
            ):
                xdo("keydown", key)
                time.sleep(0.21)
                xdo("keyup", key)
                assert waitfor(n)["title"] == title
                save(name)
            print(
                "Passed live SwiftLink keystroke and page exchange for Home, Station Log, Home, Links"
            )
        finally:
            if app.poll() is None:
                os.killpg(app.pid, signal.SIGTERM)
                app.wait()
            server.terminate()
