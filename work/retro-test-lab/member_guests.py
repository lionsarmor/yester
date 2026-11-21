"""Connect the vintage emulator's actual serial requests to the selected member."""
import hashlib
import http.client
import json
import os
import pty
import re
import select
import shutil
import socket
import subprocess
import sys
import textwrap
import threading
import time
import tty
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, build_opener
from pathlib import Path
from launch import LAB, ROOT, KIT, FANS, HOST, guest, module, member_origin
from legacy_gateway import Gateway, SameMember

eight = module("ys_eight", KIT / "8bit/launch.py")


class Bulletin(HTMLParser):
    def __init__(self):
        super().__init__()
        self.body = []
        self.links = {}
        self.pre = self.li = False
        self.href = ""
        self.label = ""

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self.pre = True
        if tag == "li":
            self.li = True
        if self.li and tag == "a":
            self.href = dict(attrs).get("href", "")
            self.label = ""

    def handle_endtag(self, tag):
        if tag == "pre":
            self.pre = False
        if tag == "li":
            self.li = False
        if tag == "a" and self.href:
            key = self.label.strip()[:1].upper()
            if key and urlsplit(self.href).path == "/bbs/":
                self.links[key] = self.href
            self.href = ""

    def handle_data(self, text):
        if self.pre:
            self.body.append(text)
        if self.href:
            self.label += text


class ScreenReader:
    def __init__(self, slug, width, height, log):
        self.origin = member_origin(slug)
        self.home = self.origin + f"/bbs/?page=home&columns={width}"
        self.opener = build_opener(SameMember(self.origin))
        self.width = width
        self.height = height
        self.log = log
        self.links = {}
        self.rows = []
        self.offset = 0

    def screen(self, key):
        url = self.home if key in ("?", "0", "H") else self.links.get(key)
        if url:
            try:
                req = Request(url, headers={"User-Agent":"YesterSites-Emulator-Lab/1.0"})
                with self.opener.open(req, timeout=30) as response:
                    raw = response.read(262145)
                    if len(raw) > 262144:
                        raise ValueError("BBS exceeds 256 KiB")
                    page = Bulletin()
                    page.feed(raw.decode("utf-8", "replace"))
                    if not page.body:
                        raise ValueError("No BBS screen returned")
                    self.links = {k:urljoin(url, v) for k,v in page.links.items()
                                  if urljoin(url, v).startswith(self.origin + "/bbs/")}
                    self.rows = [row for line in "".join(page.body).splitlines()
                                 for row in (textwrap.wrap(line, self.width, replace_whitespace=False) or [""])]
                    self.offset = 0
                    record = dict(key=key, url=response.url, status=response.status,
                                  title=self.rows[0], sha256=hashlib.sha256(raw).hexdigest())
            except (OSError, ValueError) as error:
                self.rows, self.links, self.offset = ["FETCH FAILED", str(error)[:self.width], "H RETRIES HOME"], {}, 0
                record = dict(key=key, url=url, error=str(error))
            with self.log.open("a") as output:
                print(json.dumps(record), file=output)
        elif key in ("N", "P"):
            last = max(0, (len(self.rows)-1)//(self.height-1))
            self.offset = max(0, min(last, self.offset + (1 if key == "N" else -1)))
        start = self.offset * (self.height-1)
        rows = self.rows[start:start + self.height-1]
        return (rows + [""] * self.height)[:self.height-1] + ["1-9 LINK  0/H HOME  N/P SCROLL"]


def c64(slug, scratch, evidence):
    reader = ScreenReader(slug, 40, 23, evidence / "requests.jsonl")
    with socket.socket() as server:
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        server.settimeout(.3)
        args, env, cwd = eight.command("c64")
        args[-1] = str(eight.MEDIA / "LIVE64.PRG")
        args[2:2] = ["-acia1", "-acia1base", "0xde00", "-acia1irq", "0",
                     "-acia1mode", "1", "-myaciadev", "0", "-rsdev1",
                     f"127.0.0.1:{server.getsockname()[1]}", "+rsdev1ip232"]
        with guest(args, env=env, cwd=cwd) as emulator:
            while emulator.poll() is None:
                try:
                    conn, _ = server.accept()
                except TimeoutError:
                    continue
                with conn:
                    try:
                        while byte := conn.recv(1):
                            key = byte.decode("ascii", "ignore").upper()
                            if key and key.isprintable():
                                rows = reader.screen(key)
                                data = ("\x0c" + "".join(row if len(row)==40 else row+"\r" for row in rows)).upper().encode("ascii", "replace")
                                for i, ch in enumerate(data):
                                    conn.sendall(bytes([ch]))
                                    time.sleep(.16 if i == 0 else .004)
                    except (BrokenPipeError, ConnectionResetError):
                        pass
            return emulator.returncode


def next_guest(slug, scratch, evidence):
    prepare = module("ys_next_image", FANS / "eight-online/prepare.py")
    args, env, cwd = eight.command("next")
    args[-1] = str(prepare.build_z("next", scratch))
    args.append("--nowelcomemessage")
    reader = ScreenReader(slug, 32, 24, evidence / "requests.jsonl")
    master, slave = pty.openpty()
    try:
        tty.setraw(slave)
        device = os.ttyname(slave)
        config = scratch / "uart.gdb"
        config.write_text(f'set environment LD_LIBRARY_PATH={env.pop("LD_LIBRARY_PATH")}\n'
                          'set pagination off\nset debuginfod enabled off\nbreak main\nrun\n'
                          f'set {{char[{len(device)+1}]}} &uartbridge_name = "{device}"\n'
                          'call (void)uartbridge_enable()\ncontinue\n')
        with guest(["gdb", "--batch", "-x", config, "--args", *args], cwd=cwd, env=env) as emulator:
            while emulator.poll() is None:
                if select.select([master], [], [], .15)[0]:
                    key = os.read(master, 1).decode("ascii", "ignore").upper()
                    if key and key.isprintable():
                        rows = reader.screen(key)
                        os.write(master, "".join(r[:32].ljust(32) for r in rows).upper().encode("ascii", "replace"))
            return emulator.returncode
    finally:
        os.close(master)
        os.close(slave)


def x16(slug, scratch, evidence):
    source = FANS / "x16-live"
    shutil.copy(LAB / "x16-reader.c", scratch)
    shutil.copy(source / "ascii.h", scratch)
    (scratch / "site.h").write_text('#define MEMBER "' + member_origin(slug) + '"\n')
    env = dict(os.environ, CC65_HOME=str(HOST / "share/cc65"), PATH=str(HOST / "bin") + ":" + os.environ["PATH"])
    subprocess.run([HOST / "bin/cl65", "-t", "cx16", "-O", "-o", "YESTER.PRG", "x16-reader.c"],
                   cwd=scratch, env=env, check=True)
    # The Lionsarmor Wi-Fi card calls curl for AT&G. Keep its transport and record real transfers.
    hook = scratch / "curl"
    hook.write_text('#!/bin/sh\nexec /usr/bin/curl --write-out "%output{>>$YS_RECEIPT}%{response_code}\\t%{url_effective}\\t%{size_download}\\n" "$@"\n')
    hook.chmod(0o700)
    env.update(PATH=str(scratch) + ":" + env["PATH"], YS_RECEIPT=str(evidence / "requests.tsv"),
               SDL_AUDIODRIVER="dummy", SDL_RENDER_DRIVER="software")
    rom = Path.home() / "Desktop/lionsarmor/X16-emulator-wifi-support/x16-emulator/build/rom.bin"
    with guest([source / "x16emu", "-rom", rom, "-wifi", "-nocapture", "-sound", "none",
                "-scale", "1", "-fsroot", scratch, "-prg", scratch / "YESTER.PRG", "-run"],
               cwd=scratch, env=env) as emulator:
        return emulator.wait()


def qmp(path, command, params):
    with socket.socket(socket.AF_UNIX) as control:
        control.settimeout(3)
        control.connect(str(path))
        with control.makefile("rwb", buffering=0) as stream:
            stream.readline()
            for cmd, data in [("qmp_capabilities", {}), (command, params)]:
                stream.write(json.dumps({"execute": cmd, "arguments": data}).encode() + b"\n")
                while True:
                    packet = json.loads(stream.readline())
                    if "error" in packet:
                        raise ValueError(str(packet["error"]))
                    if "return" in packet:
                        break
            return packet["return"]


def dismiss_local_welcome(scratch, emulator):
    # Cancel the guest networking login to enter its local desktop and start its HTTP adapter.
    from PIL import Image
    frame = scratch / "welcome.ppm"
    login_handled = clock_handled = False
    for _ in range(110):
        if emulator.poll() is not None:
            return
        try:
            qmp(scratch / "control", "screendump", {"filename": str(frame)})
            with Image.open(frame) as shot:
                def sample(x, y):
                    return shot.getpixel((x*shot.width//640,y*shot.height//480))
                grey = sample(192,160)
                if (not login_handled and sample(20,20)==(0,120,120) and grey==(184,184,184)
                        and sample(350,196)==grey and sample(225,130)==grey
                        and sample(320,183)==(248,248,248)):
                    qmp(scratch/"control", "human-monitor-command", {"command-line":"sendkey esc"})
                    login_handled = True
                if (not clock_handled and sample(20,20)==(0,120,120) and sample(517,260)==(0,120,120)
                        and sample(250,255)==(184,184,184) and sample(140,253)==(248,0,0)
                        and sample(130,220)[0] < 20 and sample(130,220)[1] < 25 and sample(130,220)[2] >= 100):
                    qmp(scratch/"control", "human-monitor-command", {"command-line":"sendkey ret"})
                    clock_handled = True
                if (clock_handled and sample(45,45)==(0,0,120) and sample(180,210)==(184,184,184)
                        and sample(310,150)==(0,120,120) and sample(289,272)==(0,0,0)):
                    qmp(scratch/"control", "human-monitor-command", {"command-line":"sendkey esc"})
                    return
        except (OSError, ValueError):
            pass
        time.sleep(1.8)


def win98(slug, scratch, evidence):
    runtime = module("ys_qemu", KIT / "windows98/launch.py")
    exe, firmware, env = runtime.qemu_runtime()
    disk = scratch / "win98.raw"
    # A disposable copy lets the guest resolve this member to its own COM1 HTTP adapter.
    subprocess.run(["cp", "--sparse=always", "--reflink=auto", FANS / "lab/system.raw", disk], check=True)
    fat = str(disk) + "@@32256"
    hosts = subprocess.check_output(["mtype", "-i", fat, "::WINDOWS/HOSTS"])
    hostfile = scratch / "HOSTS"
    hostname = urlsplit(member_origin(slug)).hostname
    hostfile.write_bytes(hosts.rstrip() + f"\r\n127.0.0.1 {hostname}\r\n".encode("ascii"))
    subprocess.run(["mcopy", "-o", "-i", fat, hostfile, "::WINDOWS/HOSTS"], check=True)
    serial = scratch / "com1"
    def report(url, status, mime, size):
        with (evidence / "requests.tsv").open("a") as output:
            print(status, mime, size, url, sep="\t", file=output)
    with Gateway(slug, 0, report) as gateway:
        threading.Thread(target=gateway.serve_forever, daemon=True).start()
        args = [exe, *firmware, "-name", "YesterSites · Windows 98 SE", "-machine", "pc,acpi=off,hpet=off",
                "-cpu", "pentium2,-apic", "-accel", "tcg", "-m", "64", "-vga", "cirrus", "-boot", "c",
                "-drive", f"file={disk},format=raw,if=ide,index=0", "-nic", "none",
                "-qmp", f"unix:{scratch}/control,server=on,wait=off",
                "-serial", f"unix:{serial},server=on,wait=off", "-display", "gtk,gl=off,zoom-to-fit=on"]
        try:
            with guest(args, env=env) as emulator, socket.socket(socket.AF_UNIX) as connection:
                (evidence / "control-path").write_text(str(scratch / "control"))
                threading.Thread(target=dismiss_local_welcome, args=(scratch, emulator), daemon=True).start()
                for _ in range(300):
                    try:
                        connection.connect(str(serial))
                        break
                    except (FileNotFoundError, ConnectionRefusedError):
                        if emulator.poll() is not None:
                            return emulator.returncode
                        time.sleep(.1)
                else:
                    raise RuntimeError("Windows 98 COM1 did not start")
                with connection.makefile("rwb", buffering=0) as stream:
                    while line := stream.readline(8192):
                        print("Windows 98 COM1:", line.decode("ascii","replace").strip(), flush=True)
                        if not line.startswith(b"GET "):
                            continue
                        path = line[4:].strip().decode("ascii", "replace")
                        if path in ("/", "/moon-relay/classic.html"):
                            reply = f"HTTP/1.0 302 Found\r\nLocation: http://{hostname}/INDEX.HTM\r\nContent-Length: 0\r\n\r\n".encode("ascii")
                        else:
                            client = http.client.HTTPConnection("127.0.0.1", gateway.server_port, timeout=55)
                            try:
                                client.request("GET", path)
                                resp = client.getresponse()
                                body = resp.read(1048001)
                                print("Windows 98 gateway:", path, resp.status, len(body), flush=True)
                                if len(body) > 1048000:
                                    reply = b"HTTP/1.0 413 Too Large\r\nContent-Length: 0\r\n\r\n"
                                else:
                                    headers = "".join(f"{k}: {v}\r\n" for k,v in resp.getheaders())
                                    reply = f"HTTP/1.0 {resp.status} {resp.reason}\r\n{headers}\r\n".encode("latin-1") + body
                            except (OSError, http.client.HTTPException) as error:
                                print("Windows 98 request failed:", path, error, flush=True)
                                reply = b"HTTP/1.0 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n"
                            finally:
                                client.close()
                        stream.write(str(len(reply)).encode() + b"\n")
                        for start in range(0, len(reply), 256):
                            if stream.read(1) != b"+":
                                raise RuntimeError("Windows 98 serial link closed")
                            stream.write(reply[start:start+256])
                return emulator.wait()
        finally:
            gateway.shutdown()
            (evidence / "control-path").unlink(missing_ok=True)
