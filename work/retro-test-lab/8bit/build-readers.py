"""Build offline native test readers from Retro Pages' own terminal_lines output."""

import argparse
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "work/desktop-app"))
from app import make_sample
from project import read_project, terminal_lines


def screen_text(lines):
    return [
        line.encode("ascii", "replace").decode("ascii").replace('"', "'")
        for line in lines
    ]


def basic_program(screens, routes):
    # Commodore BASIC V2 tokens. The X16 shares these basic commands.
    start = 0x0801

    def build(x16):
        rows = []
        direct = lambda s: s.encode("ascii")
        if x16:
            rows.append((5, b"\xce\x863:\xce\x8d5,0"))
        else:
            rows.append((5, b"\x9753280,0:\x9753281,0:\x99\xc7(30);"))
        for n, lines in enumerate(screens):
            first = 100 + n * 50
            rows.append((first, b"\x99\xc7(147);"))
            for j, line in enumerate(lines):
                rows.append((first + j + 1, b'\x99"' + direct(line.upper()) + b'"'))
            wait = first + 26
            rows.append((wait, b'\xa1K$:\x8bK$\xb2""\xa7' + direct(str(wait))))
            rows.append((wait + 1, b'\x8bK$\xb2"H"\xa7100'))
            picked = {
                **{str(k + 1): dst for k, dst in enumerate(routes[n][:9])},
                "N": routes[n][9],
                "P": routes[n][10],
            }
            for j, (key, dst) in enumerate(picked.items()):
                if dst != n:
                    rows.append(
                        (
                            wait + 2 + j,
                            b'\x8bK$\xb2"'
                            + direct(key)
                            + b'"\xa7'
                            + direct(str(100 + 50 * dst)),
                        )
                    )
            rows.append((first + 44, b"\x89" + direct(str(wait))))
        out = bytearray(struct.pack("<H", start))
        for num, body in rows:
            addr = start + len(out) - 2 + 5 + len(body)
            out += struct.pack("<HH", addr, num) + body + b"\0"
        out += b"\0\0"
        return out

    return build(False), build(True)


def build(site, dest):
    pages = {"home": site, **{p["page_id"]: p for p in site.get("pages", [])}}
    screens = []
    table = []
    index = {}
    for key, page in pages.items():
        lines, links = terminal_lines(page, site, key, 32)
        if len(links) > 9:
            raise ValueError(
                "This lab reader supports nine link keys per page. Use a smaller test page."
            )
        chunks = [screen_text(lines[i : i + 18]) for i in range(0, len(lines), 18)] or [
            []
        ]
        index[key] = len(screens)
        for j, chunk in enumerate(chunks):
            screen = ["RETRO PAGES / OFFLINE TEXT", "-" * 30] + chunk
            screen += [""] * (21 - len(screen))
            screen += ["1-9 LINK    H HOME"]
            if len(chunks) > 1:
                screen += ["N NEXT      P PREVIOUS"]
            screens.append(screen)
            table.append((key, j, len(chunks), links))
    routes = []
    for n, (key, j, size, links) in enumerate(table):
        target = [index[link] for link in links]
        routes.append(
            target
            + [n] * (9 - len(target))
            + [n + 1 if j + 1 < size else n, n - 1 if j else n]
        )
    if len(screens) > 18:
        raise ValueError("Use a smaller fixture for the single-bank Next reader.")
    dest.mkdir(exist_ok=True, parents=True)
    c64, x16 = basic_program(screens, routes)
    if len(c64) > 38000:
        raise ValueError("C64 reader exceeds BASIC memory.")
    (dest / "SIGNAL64.PRG").write_bytes(c64)
    (dest / "SIGNAL16.PRG").write_bytes(x16)
    asm = (HERE / "reader.asm").read_text()
    asm += "pages: dw " + ",".join(f"p{i}" for i in range(len(screens))) + "\n"
    asm += "targets:\n" + "".join(
        "db " + ",".join(map(str, row)) + "\n" for row in routes
    )
    for i, screen in enumerate(screens):
        asm += f"p{i}:\n"
        for line in screen + [""] * (24 - len(screen)):
            asm += "db " + ",".join(map(str, line.ljust(32).encode("ascii"))) + "\n"
    with tempfile.TemporaryDirectory(dir=HERE) as temp:
        base = Path(temp)
        src = base / "reader.asm"
        src.write_text(asm)
        output = base / "reader.bin"
        subprocess.run(
            [str(HERE / "host/usr/bin/z80asm"), "-o", str(output), str(src)], check=True
        )
        binary = output.read_bytes()
    if len(binary) > 0x4000:
        raise ValueError("Next reader exceeds its memory bank.")
    header = bytearray(512)
    header[:8] = b"NextV1.2"
    header[9] = 1
    header[20] = 1
    struct.pack_into("<HH", header, 12, 65500, 32768)
    (dest / "SIGNAL.NEX").write_bytes(header + binary.ljust(16384, b"\0"))
    # 48K SNA restores the PC by popping it from the guest stack.
    hdr = bytearray(27)
    struct.pack_into("<H", hdr, 23, 65500)
    hdr[25] = 1
    ram = bytearray(49152)
    ram[16384 : 16384 + len(binary)] = binary
    struct.pack_into("<H", ram, 65500 - 16384, 32768)
    (dest / "SIGNAL48.SNA").write_bytes(hdr + ram)
    (dest / "terminals.json").write_text(
        json.dumps({"screens": screens, "links": routes}, indent=2) + "\n"
    )
    print(
        f"Exported {len(pages)} pages, {len(screens)} screens for C64, X16, Next and Spectrum 48K."
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--project", type=Path)
    p.add_argument(
        "--out", default=ROOT / "outputs/Retro-Page-test-lab/8bit/media", type=Path
    )
    args = p.parse_args()
    build(
        read_project(args.project) if args.project else make_sample(),
        args.out.resolve(),
    )
