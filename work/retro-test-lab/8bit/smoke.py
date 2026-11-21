import os
from pathlib import Path
import sys
import subprocess
import time
from PIL import ImageGrab, ImageChops
from concurrent.futures import ThreadPoolExecutor

base = Path(__file__).resolve().parents[3]
out = base / "outputs/Retro-Page-test-lab/8bit"
sys.path.insert(0, str(out))
from launch import command, HOST


def smoke(target):
    directory = out / "evidence"
    directory.mkdir(exist_ok=True)
    logdir = Path(__file__).resolve().parent / "logs"
    logdir.mkdir(exist_ok=True)
    env = {**os.environ, "LD_LIBRARY_PATH": str(HOST / "usr/lib/x86_64-linux-gnu")}
    xv = base / "work/winpkg/winecheck/sysroot/usr/bin/Xvfb"
    with subprocess.Popen(
        [
            str(xv),
            "-displayfd",
            "1",
            "-screen",
            "0",
            "1540x1120x24",
            "-nolisten",
            "tcp",
            "-ac",
        ],
        stdout=subprocess.PIPE,
        stderr=(logdir / (target + "-xvfb.log")).open("w"),
        text=True,
    ) as server:
        display = ":" + server.stdout.readline().strip()
        args, app_env, cwd = command(target)
        app_env["DISPLAY"] = env["DISPLAY"] = display
        tool = HOST / "usr/bin/xdotool"

        def xdo(*args, check=True):
            return subprocess.run(
                [str(tool), *map(str, args)],
                env=env,
                text=True,
                capture_output=True,
                check=check,
            ).stdout.strip()

        with (logdir / (target + ".log")).open("w") as log:
            app = subprocess.Popen(args, env=app_env, cwd=cwd, stdout=log, stderr=log)
            try:
                time.sleep(9)
                if app.poll() is not None:
                    raise RuntimeError((logdir / (target + ".log")).read_text()[-1200:])
                output = xdo("search", "--onlyvisible", "--pid", app.pid, check=False)
                if not output:
                    output = xdo("search", "--onlyvisible", "--name", ".", check=False)
                windows = output.splitlines()
                if not windows:
                    raise RuntimeError("no emulator window")
                win = max(windows, key=lambda id: len(xdo("getwindowname", id)))
                print(
                    target,
                    windows,
                    [(i, xdo("getwindowname", i)) for i in windows],
                    flush=True,
                )
                xdo("windowfocus", win, check=False)

                def shot(name):
                    geom = dict(
                        entry.split("=", 1)
                        for entry in xdo(
                            "getwindowgeometry", "--shell", win
                        ).splitlines()
                    )
                    x, y, w, h = (
                        int(geom[field]) for field in ("X", "Y", "WIDTH", "HEIGHT")
                    )
                    capture = ImageGrab.grab(
                        bbox=(x, y, x + w, y + h), xdisplay=display
                    )
                    capture.save(directory / (target + "-" + name + ".png"))

                shot("home")
                for k, name in [
                    ("1", "station-log"),
                    ("h", "home-return"),
                    ("2", "links"),
                ]:
                    xdo("keydown", k)
                    time.sleep(0.16)
                    xdo("keyup", k)
                    time.sleep(0.5)
                    shot(name)
            finally:
                if app.poll() is None:
                    app.terminate()
                try:
                    app.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    app.kill()
                    app.wait()
                server.terminate()


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=4) as jobs:
        for res in jobs.map(
            smoke, sys.argv[1:] or ["c64", "x16", "next", "spectrum48"]
        ):
            pass
