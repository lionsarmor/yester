#!/usr/bin/env python3
"""Run a local BBS text session over the C64 emulator's SwiftLink serial connection."""

import argparse
import json
import socket
import subprocess
import time
from pathlib import Path
from launch import MEDIA, command


def run(log_path):
    fixture = json.loads((MEDIA / "terminals.json").read_text())
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
    with socket.socket() as server:
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        server.settimeout(0.25)
        args, env, cwd = command("c64")
        args[-1] = str(MEDIA / "LIVE64.PRG")
        args[2:2] = [
            "-acia1",
            "-acia1base",
            "0xde00",
            "-acia1irq",
            "0",
            "-acia1mode",
            "1",
            "-myaciadev",
            "0",
            "-rsdev1",
            f"127.0.0.1:{server.getsockname()[1]}",
            "+rsdev1ip232",
        ]
        with subprocess.Popen(args, cwd=cwd, env=env) as machine:
            try:
                while machine.poll() is None:
                    try:
                        conn, _ = server.accept()
                    except TimeoutError:
                        continue
                    with conn:
                        conn.settimeout(0.25)
                        # A cartridge reset may connect briefly before the PRG enables DTR.
                        # Wait for startup; the guest sends '?' once its receiver is ready.
                        state = None
                        while machine.poll() is None:
                            try:
                                char = conn.recv(1)
                            except TimeoutError:
                                continue
                            if not char:
                                break
                            key = char.decode("ascii", "ignore").upper()
                            if not key:
                                continue
                            if key == "?":
                                target = 0
                            elif state is None:
                                continue
                            elif key == "H":
                                target = 0
                            elif key in "123456789NP":
                                index = "123456789NP".index(key)
                                target = fixture["links"][state][index]
                            else:
                                continue
                            screen = list(fixture["screens"][target])
                            screen[0] = "RETRO PAGES / LIVE SERIAL"
                            payload = (
                                ("\x0c" + "\r".join(screen) + "\r")
                                .upper()
                                .encode("ascii")
                            )
                            for j in range(len(payload)):
                                conn.sendall(payload[j : j + 1])
                                time.sleep(0.16 if j == 0 else 0.004)
                            if log_path:
                                with log_path.open("a") as out:
                                    out.write(
                                        json.dumps(
                                            {
                                                "key": key,
                                                "screen": target,
                                                "title": screen[2],
                                                "bytes_sent": len(payload),
                                            }
                                        )
                                        + "\n"
                                    )
                            state = target
            except (ConnectionResetError, BrokenPipeError, KeyboardInterrupt):
                pass
            finally:
                if machine.poll() is None:
                    machine.terminate()
                try:
                    machine.wait(4)
                except subprocess.TimeoutExpired:
                    machine.kill()
                    machine.wait()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--log", type=Path)
    run(p.parse_args().log)
