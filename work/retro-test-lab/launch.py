#!/usr/bin/python3
"""Open a published YesterSites member in a vintage guest on this workstation."""
import argparse
import contextlib
import importlib.util
import os
import signal
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

LAB = Path(__file__).resolve().parent
ROOT = LAB.parents[1]
KIT = ROOT / "outputs/Retro-Page-test-lab"
FANS = ROOT / "work/fan-sites"
HOST = LAB / "8bit/host/usr"
sys.path.insert(0, str(KIT / "windows31"))
from legacy_gateway import member_origin

MACHINES = {
    "win31": ("Windows 3.1", "NCSA Mosaic 1.0 · graphical classic edition"),
    "win98": ("Windows 98 SE", "Internet Explorer 5 · graphical classic edition"),
    "c64": ("Commodore 64", "VICE · SwiftLink serial BBS"),
    "x16": ("Commander X16", "Lionsarmor Wi-Fi · native 65C02 BBS reader"),
    "next": ("Spectrum Next", "ZEsarUX · 32-column UART BBS"),
}
DEFAULT = "switchboard-radio"


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    instance = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(instance)
    return instance


def member(value):
    value = value.strip().lower()
    if "." in value:
        url = urlsplit(value if "://" in value else "https://" + value)
        host = url.hostname or ""
        if url.scheme not in ("http", "https") or not host.endswith(".yestersites.com") or url.username or url.password or url.port or url.path not in ("", "/") or url.query or url.fragment:
            raise ValueError("Enter a member name or its YesterSites homepage address.")
        value = host.removesuffix(".yestersites.com")
    member_origin(value)
    return value


@contextlib.contextmanager
def guest(*args, **kwargs):
    proc = subprocess.Popen(*args, **kwargs, start_new_session=True)
    try:
        yield proc
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(4)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()


def run(machine, slug, evidence):
    from member_guests import c64, next_guest, win98, x16
    if machine == "win31":
        args = [sys.executable, KIT / "windows31/launch-windows31.py", slug,
                "--media-dir", LAB / "windows31", "--request-log", evidence / "requests.tsv"]
        with guest(args) as proc:
            return proc.wait()
    with tempfile.TemporaryDirectory(prefix="ys-" + machine + "-") as session:
        return {"c64": c64, "next": next_guest, "x16": x16, "win98": win98}[machine](slug, Path(session), evidence)


def menu():
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk
    app = Gtk.Dialog(title="YesterSites Emulator Lab")
    app.set_default_size(510, 260)
    app.set_border_width(12)
    app.add_button("Close", Gtk.ResponseType.CANCEL)
    app.add_button("Launch machine", Gtk.ResponseType.OK)
    app.set_default_response(Gtk.ResponseType.OK)
    form = app.get_content_area()
    form.set_spacing(10)
    form.pack_start(Gtk.Label(label="Published member name or homepage", xalign=0), False, False, 0)
    entry = Gtk.Entry()
    entry.set_text(DEFAULT)
    entry.set_activates_default(True)
    form.pack_start(entry, False, False, 0)
    form.pack_start(Gtk.Label(label="Computer", xalign=0), False, False, 0)
    choices = Gtk.ComboBoxText()
    for key, (name, detail) in MACHINES.items():
        choices.append(key, f"{name}  —  {detail}")
    choices.set_active(0)
    form.pack_start(choices, False, False, 0)
    info = Gtk.Label(label="Each guest reads the public member site through its network adapter.", xalign=0)
    form.pack_start(info, False, False, 0)
    app.show_all()
    while app.run() == Gtk.ResponseType.OK:
        try:
            selected = choices.get_active_id(), member(entry.get_text())
            app.destroy()
            while Gtk.events_pending():
                Gtk.main_iteration_do(False)
            return selected
        except ValueError as error:
            info.set_text(str(error))
    app.destroy()
    return None


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("machine", nargs="?", choices=MACHINES)
    cli.add_argument("site", nargs="?", type=member, default=DEFAULT)
    cli.add_argument("--evidence", type=Path, help="directory for this session's request log")
    opts = cli.parse_args()
    selection = (opts.machine, opts.site) if opts.machine else menu()
    if not selection:
        return 0
    machine, site = selection
    folder = opts.evidence
    if not folder:
        state = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state"))
        folder = state / "yestersites/emulator-lab" / f"{datetime.now():%Y%m%d-%H%M%S}-{machine}-{site}-{os.getpid()}"
    folder.mkdir(parents=True, exist_ok=True)
    print(f"{MACHINES[machine][0]} · {member_origin(site)} · {folder}", flush=True)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        return run(machine, site, folder.resolve()) or 0
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        if not opts.machine:
            subprocess.run(["zenity", "--error", "--text", str(error)])
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
