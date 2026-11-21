# Public member site on five retro clients

[Newer Switchboard Radio check on five clients, including a creator-uploaded binary recovered from Windows 98](switchboard/README.md).

On November 21, 2026 (Manila time), five emulated machines requested the live [Roddy Radio Aircheck site](https://roddy-aircheck-1121.yestersites.com/). Home, Station Log and Links were separate published pages. The graphical edition contained GIF artwork, the BBS edition included a numbered menu, and the plain-text terminal edition was available as a 216-byte file. All requests in the attached logs reached the public member subdomain during the run.

| Machine and client | Network route used during the test | Verified inside the emulator |
| --- | --- | --- |
| Windows 3.1, NCSA Mosaic 1.0, DOSBox-X | Trumpet Winsock and NE2000 over SLIRP, loopback HTTP relay to canonical HTTPS | Mosaic displayed banner and tower GIFs, opened the Station Log link and displayed the terminal text file. |
| Windows 98, Internet Explorer 5, QEMU | Browser HTTP to an in-guest Win32 loopback service, COM1 to a host relay, validated public HTTPS | Home displayed wallpaper, title and radio tower GIFs. Selecting Station Log loaded its page and GIF. IE downloaded the terminal file, saved it as C:\AIRCHECK.TXT and reopened it in Windows Notepad. |
| Commodore 64, VICE, native serial reader | SwiftLink at $DE00, socket to an HTML-to-serial gateway, public HTTPS | In both the text and BBS editions, the real guest keys 1, H and 2 opened Station Log, returned home and opened Links. |
| Commander X16, native 65C02 reader | Lionsarmor Wi-Fi-enabled X16 emulator, UART AT&G command, host HTTPS fetch | The text and BBS editions both loaded. On each, the same three guest keypresses fetched all three destinations. |
| Spectrum Next, ZEsarUX TBBlue, native Z80 reader | Emulated UART, host PTY to an HTML-to-serial gateway, public HTTPS | In both editions, 1, H and 2 fetched the correct pages. |

## Compatibility findings

The initial Win3.1 relay supplied HTTPS transport and rewrote same-site URLs to route subsequent requests through it. The raw classic page displayed Cloudflare-injected script as body text. Mosaic also displayed image errors for extensionless media addresses. A second run removed the script in the relay, used short, relative GIF names for this site's images, and mapped long page names to short relative HTML addresses. Upstream URLs and original media bytes remained the same. Compare [before adaptation](win31-home.png) with [after adaptation](win31-home-adapted.png). The test does not establish direct modern TLS support in vintage browsers.

The eight-bit clients displayed a text representation. C64 and Next parsed text and numbered destinations in the host gateway. X16 parsed the response in guest memory and has an 8 KiB response budget in this modem setup. BBS navigation was tested over the published HTTPS BBS endpoints through the reader adapters. No public dial-up or raw Telnet listener was tested. The fixture provided the downloadable terminal text edition. It had no separately uploaded binary file in a BBS file area.

## Captures and network records

- Windows 3.1 — [adapted Home](win31-home-adapted.png), [Station Log](win31-station-log.png), [terminal file](win31-terminal.png), [upstream requests](win31.jsonl).
- Windows 98 — [Home](win98-home.png), [Station Log](win98-station-log.png), [terminal file](win98-terminal.png), [file saved and reopened in Notepad](win98-saved-file.png), [upstream requests](win98.jsonl).
- C64 — [text Home](c64-serial-home.png), [BBS Station Log](bbs/c64-serial-station-log.png), [text requests](c64-serial.jsonl), [BBS keypresses and requests](bbs/c64-serial.jsonl).
- Commander X16 — [text Home](x16-home.png), [BBS Station Log](bbs/x16-station-log.png), [text requests](requests.tsv), [BBS requests](bbs/requests.tsv).
- Spectrum Next — [text Home](next-home.png), [BBS Station Log](bbs/next-station-log.png), [text requests](next.jsonl), [BBS keypresses and requests](bbs/next.jsonl).

JSONL records include the exact upstream URL, HTTP result and a digest of the upstream response bytes. The X16 curl TSV records HTTP status, effective URL and byte count. A changing digest for the same public HTML may reflect the request-specific script injected at the edge.
