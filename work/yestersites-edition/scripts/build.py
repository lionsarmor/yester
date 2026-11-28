"""Package the five member sites and studio in a dependency-free Worker module."""
import base64
import hashlib
import json
import mimetypes
import os
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
assets = {}
for path in sorted((root / 'public').rglob('*')):
    if path.is_file():
        raw = path.read_bytes()
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix == '.js':
            mime = 'application/javascript'
        if mime.startswith('text/') or path.suffix == '.js':
            mime += '; charset=utf-8'
        assets['/' + path.relative_to(root / 'public').as_posix()] = [
            mime, hashlib.sha256(raw).hexdigest()[:20], base64.b64encode(raw).decode('ascii')
        ]
backend = (root/'public/assets/topics.js').read_text() + '\n' + (root/'public/desktop/publish/bbs-codec.js').read_text() + '\n' + (root/'public/desktop/publish/format.js').read_text() + '\n' + (root/'public/desktop/publish/member-storage.js').read_text() + '\n' + (root/'public/desktop/publish/craft.js').read_text() + '\n' + (root/'public/desktop/publish/media.js').read_text() + '\n' + (root/'src/worker.mjs').read_text() + "\n" + (root/'src/host-renderer.js').read_text() + "\n" + (root/'src/revisions.js').read_text()
backend += '\nconst originalSites=' + (root/'src/originals.json').read_text() + ';\n' + (root/'src/neighborhood.js').read_text() + '\n'
backend += (root/'src/passwords.js').read_text() + '\n'
backend += (root/'src/member-badge.js').read_text() + '\n'
backend += (root/'src/profiles.js').read_text() + '\n'
backend += (root/'src/roddy-id.js').read_text() + '\n'
backend += (root/'src/accounts.js').read_text() + '\n'
backend += '\nconst founderFiles=' + (root/'src/founder-files.json').read_text() + ';\n'
backend += (root/'public/desktop/publish/zip.js').read_text().replace('window.makeSiteZip =', 'const makeOriginalZip =') + '\n'
backend += (root/'src/my-sites.js').read_text() + '\n'
backend += (root/'src/video-search.js').read_text() + '\n'
backend += (root/'src/proton-smtp.js').read_text() + '\n'
backend += (root/'src/email-reset.js').read_text() + '\n'
bridge = '(() => {\n' + (root/'src/reading-place.js').read_text() + '\n' + (root/'src/surfer-bridge.js').read_text() + '\n})();'
backend += '\nconst surferBridge=' + json.dumps(bridge) + ';\nconst surferBridgeHash=' + json.dumps(base64.b64encode(hashlib.sha256(bridge.encode()).digest()).decode()) + ';\n'
dispatch = (root/'src/dispatch.js').read_text()
if backend.count('export default ') != 1:
    raise ValueError('Expected one member API handler')
for name in ('FOUNDER_EMAIL_SHA256', 'FOUNDER_ACTIVATION_SHA256'):
    value = os.environ.get(name, '')
    if value and not re.fullmatch('[0-9a-f]{64}', value):
        raise ValueError(f'{name} must be a lowercase SHA-256 hex digest')
    backend = backend.replace('__' + name + '__', value)
entry = root/'dist/server/index.js'
entry.parent.mkdir(parents=True, exist_ok=True)
entry.write_text(backend.replace('export default ', 'const memberApp = ') +
                 '\nconst assets = ' + json.dumps(assets,separators=(',',':')) + ';\n' + dispatch)
