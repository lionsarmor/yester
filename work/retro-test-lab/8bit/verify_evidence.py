"""Verify the recorded guest image transitions and the four live C64 serial transactions."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

EVIDENCE = (
    Path(__file__).resolve().parents[3] / "outputs/Retro-Page-test-lab/8bit/evidence"
)
TAGS = ("home", "station-log", "home-return", "links")
summary = {}
for machine in ("c64", "x16", "next", "spectrum48", "c64-serial"):
    files = {tag: EVIDENCE / f"{machine}-{tag}.png" for tag in TAGS}
    ims = {tag: Image.open(file).convert("RGB") for tag, file in files.items()}
    # Exclude VICE's host status bar, whose percentage indicator sometimes changes.
    if machine.startswith("c64"):
        ims = {
            tag: im.crop((0, 27, im.width, im.height - 83)) for tag, im in ims.items()
        }
    home = ims["home"]
    assert len({im.size for im in ims.values()}) == 1
    assert not ImageChops.difference(home, ims["home-return"]).getbbox(), machine
    assert ImageChops.difference(home, ims["station-log"]).getbbox(), machine
    assert ImageChops.difference(home, ims["links"]).getbbox(), machine
    assert ImageChops.difference(ims["station-log"], ims["links"]).getbbox(), machine
    summary[machine] = {
        "sequence": ["Home", "1 -> Station Log", "H -> Home", "2 -> Links"],
        "guest_pixels_equal_after_home_return": True,
        "captures_sha256": {
            tag: hashlib.sha256(file.read_bytes()).hexdigest()
            for tag, file in files.items()
        },
    }
requests = [
    json.loads(s) for s in (EVIDENCE / "c64-serial.jsonl").read_text().splitlines()
]
assert [(r["key"], r["title"]) for r in requests] == [
    ("?", "LATE NIGHT SIGNAL"),
    ("1", "STATION LOG"),
    ("H", "LATE NIGHT SIGNAL"),
    ("2", "LINKS"),
]
assert all(r["bytes_sent"] > 0 for r in requests)
(EVIDENCE / "results.json").write_text(json.dumps(summary, indent=2) + "\n")
print(
    "Five capture sets match the expected guest transitions; C64 serial log verified."
)
