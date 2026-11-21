"""Capture the real desktop Publish button's handoff without navigating externally."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import base64
import json
import re
import sys
import tkinter as tk

work = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(work / 'desktop-app'))
from app import Studio
from project import save_project

with TemporaryDirectory(prefix='retro-publish-qa-') as tmp:
    root = tk.Tk()
    root.withdraw()
    studio = Studio(root)
    studio.site['slug'] = 'late-night-desktop'
    studio.site['listed'] = False
    studio.path = Path(tmp) / 'actual.yst'
    save_project(studio.path, studio.site)
    studio.saved = studio.site.copy()
    with patch('app.webbrowser.open') as opened, patch('app.messagebox.askyesno', return_value=False), patch.object(studio, 'error', side_effect=RuntimeError):
        studio.publish()
    assert opened.call_count == 1, 'the desktop editor did not open its publishing desk'
    target = Path(studio.tmp.name, 'publish.html').read_text(encoding='utf8')
    draft = re.search(r'#draft=([A-Za-z0-9_-]+)', target)
    assert draft, 'publishing handoff missing draft'
    decoded = base64.urlsafe_b64decode(draft[1] + '===')
    site = json.loads(decoded)
    assert len(site.get('document', site)['pages']) == 2
    sys.stdout.buffer.write(decoded)
    root.destroy()
