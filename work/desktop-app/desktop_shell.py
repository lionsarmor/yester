"""Run the packaged Retro Page editor in a desktop application window."""
import hashlib
import hmac
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import webbrowser

PORT = 43761
HOST = f"127.0.0.1:{PORT}"
ORIGIN = "http://" + HOST
ROOT = Path(__file__).resolve().parent
WEB = ROOT / "editor" if (ROOT / "editor").is_dir() else ROOT.parent / "retro-page-web"
DATA = Path(os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share") / "RetroPage"
STATE = DATA / "desktop-session"
LIMIT = 24 * 1024 * 1024


def window(url):
    """Use an application window when a supported Chromium browser is installed."""
    if sys.platform == "win32":
        for directory in ("PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA"):
            for application in ("Microsoft/Edge/Application/msedge.exe", "Google/Chrome/Application/chrome.exe",
                                "BraveSoftware/Brave-Browser/Application/brave.exe"):
                if os.environ.get(directory):
                    exe = Path(os.environ[directory]) / application
                    if exe.is_file():
                        subprocess.Popen([str(exe), "--app=" + url])
                        return
    elif sys.platform == "darwin":
        for app in ("Google Chrome", "Microsoft Edge", "Brave Browser"):
            if (Path("/Applications") / (app + ".app")).exists():
                subprocess.Popen(["open", "-na", app, "--args", "--app=" + url])
                return
    else:
        for app in ("brave-browser", "chromium", "google-chrome", "chromium-browser", "microsoft-edge"):
            if shutil.which(app):
                subprocess.Popen([app, "--app=" + url], start_new_session=True)
                return
        if shutil.which("flatpak"):
            for app in ("com.brave.Browser", "org.chromium.Chromium", "com.google.Chrome"):
                if subprocess.run(["flatpak", "info", app], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                    subprocess.Popen(["flatpak", "run", app, "--app=" + url], start_new_session=True)
                    return
    if not webbrowser.open_new(url):
        raise RuntimeError("Install a modern browser, then open Retro Page again.")


def signature(key, message):
    return hmac.new(key, message.encode("ascii"), hashlib.sha256).hexdigest().encode("ascii")


def existing_server():
    # Confirm the port belongs to this user's running launcher before handing it a file.
    challenge = secrets.token_hex(16)
    for attempt in range(6):
        try:
            key = (STATE / "instance").read_bytes()
            conn = HTTPConnection("127.0.0.1", PORT, timeout=2)
            try:
                conn.request("GET", "/desktop/identity/" + challenge)
                response = conn.getresponse()
                if response.status == 200 and hmac.compare_digest(response.read(65), signature(key, challenge)):
                    return True
            finally:
                conn.close()
        except OSError:
            pass
        time.sleep(.15)
    return False


class EditorServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", PORT), EditorRequest)
        self.key = secrets.token_bytes(32)
        self.last_use = time.monotonic()
        self.files = {"/" + path.relative_to(WEB).as_posix(): path for path in WEB.rglob("*") if path.is_file()}
        self.files["/"] = WEB / "index.html"


class EditorRequest(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # One-use file tickets stay out of logs.

    def send(self, status, data=b"", mime="text/plain"):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.headers.get("Host") != HOST:
            return self.send(403)
        path = urlsplit(self.path).path
        challenge = re.fullmatch(r"/desktop/identity/([0-9a-f]{32})", path)
        if challenge:
            return self.send(200, signature(self.server.key, challenge[1]))
        ticket = re.fullmatch(r"/desktop/project/([0-9a-f]{48})", path)
        if ticket:
            if self.headers.get("X-Retro-Page") != "open":
                return self.send(403)
            source = STATE / (ticket[1] + ".yst")
            try:
                with source.open("rb") as file:
                    data = file.read(LIMIT + 1)
                source.unlink()
            except FileNotFoundError:
                return self.send(404)
            if len(data) > LIMIT:
                return self.send(413)
            return self.send(200, data, "application/json")
        self.server.last_use = time.monotonic()
        if path == "/desktop/awake":
            return self.send(204)
        if path == "/offline.js":
            return self.send(404)  # Installed files are already available offline.
        if path == "/desktop-window.js":
            return self.send(200, (ROOT / "desktop-window.js").read_bytes(), "text/javascript")
        source = self.server.files.get(path)
        if source is None:
            return self.send(404)
        data = source.read_bytes()
        if source.name == "index.html":
            data = data.replace(b'<script defer src="./app.js"></script>',
                                b'<script defer src="./app.js"></script><script defer src="./desktop-window.js"></script>')
        mime = "text/javascript" if source.suffix == ".js" else mimetypes.guess_type(source.name)[0]
        self.send(200, data, mime or "application/octet-stream")


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    STATE.mkdir(mode=0o700, exist_ok=True)
    if not (WEB / "app.js").is_file():
        raise RuntimeError("Extract the complete Retro Page download before opening it.")
    project = None
    if len(sys.argv) > 1:
        project = Path(sys.argv[1]).expanduser()
        if not project.is_file() or project.stat().st_size > LIMIT:
            raise ValueError("Choose an existing .yst project up to 24 MiB.")
    try:
        server = EditorServer()
    except OSError:
        if not existing_server():
            raise RuntimeError(f"Retro Page could not open its local editor port {PORT}. Close the other program using it and try again.")
        server = None
    if server:
        with (STATE / "instance").open("wb") as handle:
            handle.write(server.key)
        for old in STATE.glob("*.yst"):
            if time.time() - old.stat().st_mtime > 3600:
                old.unlink(missing_ok=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
    try:
        url = ORIGIN + "/"
        if project:
            ticket = secrets.token_hex(24)
            with project.open("rb") as source:
                data = source.read(LIMIT + 1)
            if len(data) > LIMIT:
                raise ValueError("Choose a project up to 24 MiB.")
            (STATE / (ticket + ".yst")).write_bytes(data)
            url += "#desktop-open=" + ticket
        window(url)
        if server:
            # A minimized browser window can throttle its timers for several minutes.
            while time.monotonic() - server.last_use < 3600:
                time.sleep(10)
    finally:
        if server:
            server.shutdown()
            server.server_close()


def launch():
    try:
        main()
    except (OSError, RuntimeError, ValueError) as error:
        if sys.stderr:
            print(str(error), file=sys.stderr)
        try:
            from tkinter import messagebox
            messagebox.showerror("Retro Page", str(error))
        except Exception:
            pass
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(launch())
