#!/usr/bin/env python3
"""Start one of this workstation's 8-bit test machines with the local reader."""

import argparse
from pathlib import Path
import os

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
HOST = ROOT / "work/retro-test-lab/8bit/host"
BUDDY = Path.home() / "Desktop/lionsarmor/BUDDY/.tools"
MEDIA = HERE / "media"


def command(machine):
    env = os.environ.copy()
    env.update(SDL_RENDER_DRIVER="software", SDL_AUDIODRIVER="dummy")
    cwd = MEDIA
    if machine == "c64":
        vice = HOST / "usr/bin/x64sc"
        rom = BUDDY / "emulators/roms/c64"
        env["LD_LIBRARY_PATH"] = str(HOST / "usr/lib/x86_64-linux-gnu")
        args = [
            vice,
            "-default",
            "+sound",
            "-directory",
            HOST / "usr/share/vice",
            "-kernal",
            rom / "kernal-901227-03.bin",
            "-basic",
            rom / "basic-901226-01.bin",
            "-chargen",
            rom / "chargen-901225-01.bin",
            "-drive8type",
            "0",
            "+drive8truedrive",
            "-autostartprgmode",
            "1",
            "-autostart",
            MEDIA / "SIGNAL64.PRG",
        ]
    elif machine == "x16":
        emu = BUDDY / "x16emu"
        args = [
            emu / "x16emu",
            "-rom",
            emu / "rom.bin",
            "-fsroot",
            MEDIA,
            "-scale",
            "1",
            "-quality",
            "nearest",
            "-prg",
            MEDIA / "SIGNAL16.PRG",
            "-run",
        ]
    else:
        emu = BUDDY / "zesarux/ZEsarUX-13.0"
        env["LD_LIBRARY_PATH"] = str(BUDDY / "emulators/root/usr/lib/x86_64-linux-gnu")
        cwd = emu
        target, romarg = (
            ("TBBlue", ["--tbblue-fast-boot-mode"])
            if machine == "next"
            else ("48k", [])
        )
        file = MEDIA / ("SIGNAL.NEX" if machine == "next" else "SIGNAL48.SNA")
        args = [
            emu / "zesarux",
            "--noconfigfile",
            "--machine",
            target,
            *romarg,
            "--vo",
            "xwindows",
            "--ao",
            "null",
            "--zoom",
            "1" if machine == "next" else "2",
            "--nosplash",
            "--disable-all-first-aid",
            "--disablefooter",
            "--quickexit",
            "--mmc-no-persistent-writes",
            "--snap",
            file,
        ]
    return list(map(str, args)), env, cwd


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("machine", choices=("c64", "x16", "next", "spectrum48"))
    a = p.parse_args()
    args, env, cwd = command(a.machine)
    os.chdir(cwd)
    os.execve(args[0], args, env)
