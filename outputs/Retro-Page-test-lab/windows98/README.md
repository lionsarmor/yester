# Windows 98 browser lab

Open the exported **Late Night Signal** site in a real Windows 98 Second Edition installation running under QEMU. The included CD contains the editor’s exported website files. Windows and Internet Explorer come from your locally installed guest disk.

## Start the browser

Run this command from this folder on the project workstation. A QEMU window will open.

```sh
python3 launch.py
```

1. Press Enter at the guest’s Windows logon prompt. If Date/Time Properties opens, press Enter. Close the Windows 98 welcome panel with Alt+F4.
2. Press Windows+R, enter `D:\classic.html`, then press Enter. Maximize Internet Explorer to see the complete page.
3. Follow **Station Log**, then **Links**, then **Text edition**. Alt+Left returns to the previous page. Close QEMU when you finish.

The launcher mounts the sample CD read-only and uses a temporary write layer for the guest disk. Each launch starts from the same installed Windows image. Networking is disabled. To test another site, extract its Retro Page website ZIP and pass its directory.

```sh
python3 launch.py --export /path/to/extracted-site
```

The workstation launcher finds the BUDDY QEMU runtime and Windows disk automatically. On another Linux machine, install QEMU with i386 emulation and GTK support and pass `--disk /path/to/windows98.qcow2`. Building a new CD requires `genisoimage` or `mkisofs`. The `--headless` and `--qmp` switches support automated capture.

## Verified guest session

The guest’s About dialog reported **Microsoft Internet Explorer 5.00.2614.3500**. The classic home page displayed the tiled starfield, orange bitmap lettering, radio tower GIF, body copy and navigation. The guest followed three hyperlinks in succession. On the final page, IE displayed its text edition with functioning HTML anchors. The screenshots show a 1024 × 768 guest framebuffer. This run covers local HTML and image rendering, keyboard link navigation and edition switching. Remote HTTP and HTTPS access were outside the run.

| Guest screen | What to check |
| --- | --- |
| [Home](evidence/01-classic-home.png) | `D:\classic.html`, page artwork, home navigation |
| [Station Log](evidence/02-station-log.png) | Page-specific artwork and both log entries |
| [Links](evidence/03-links.png) | Links page opened via the Station Log navigation |
| [Text edition](evidence/04-text-edition.png) | Plain Links page opened via the edition selector |
| [IE About](evidence/05-ie-version.png) | Installed browser version |

The screenshot hashes and sample CD hash are in [results.json](evidence/results.json). The test machine uses TCG, an emulated Pentium II, 64 MiB RAM, a Cirrus VGA card, and a Joliet CD so the long exported HTML and GIF filenames resolve in Windows 98.
