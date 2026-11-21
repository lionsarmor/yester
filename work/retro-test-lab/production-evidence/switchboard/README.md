# Switchboard Radio on five emulated computers

On November 21, 2026 in Manila, five emulators opened the ordinary creator account’s published Switchboard Radio site. Each route fetched the public member subdomain over validated HTTPS as the guest browsed. The creator republished during the checks, so the retained receipts reference more than one artwork revision. [Published site](https://switchboard-radio.yestersites.com/)

| Computer | Network route | Guest result |
| --- | --- | --- |
| Windows 3.1, NCSA Mosaic 1.0 | DOSBox-X NE2000, Trumpet Winsock, and the distributed loopback gateway | Displayed the radio tower on Home and opened the Station Log page and its artwork using a short URL. [Home after deployment](win31-public-home.png) · [Station Log](win31-public-station-log.png) · [Public gateway requests](win31-public.tsv) |
| Windows 98 SE, Internet Explorer 5 | QEMU, Win32 loopback HTTP and a COM1-to-HTTPS bridge | Opened the BBS, followed its F link and saved RADIO.BIN. Reading the file back from the guest FAT partition reproduced all 45 creator-uploaded bytes. [File area](win98-bbs.png) · [File download](win98-download.png) · [Saved-file verification](win98-file.json) · [Requests](win98.jsonl) |
| Commodore 64, VICE | SwiftLink serial reader and host HTTPS adapter | Guest keys 1 and H fetched Station Log and Home. [Station Log](c64-serial-station-log.png) · [Receipts](c64-serial.jsonl) |
| Commander X16 | Native 65C02 reader on Lionsarmor’s Wi-Fi-enabled emulator | The guest fetched Home, Station Log and Home through the emulated UART and parsed each BBS page in guest memory. [Station Log](x16-station-log.png) · [Receipts](requests.tsv) |
| Spectrum Next, ZEsarUX TBBlue | Native Z80 reader, emulated UART, and host HTTPS adapter | Guest keys 1 and H fetched Station Log and Home. [Station Log](next-station-log.png) · [Receipts](next.jsonl) |

The binary SHA-256 was `568feb7d06573be98459a52081c6576a7b18a2e6952eacdc3516d77e3f530232`. The file contained byte values 0 through 31, then the ASCII string SWITCHBOARD and a CR/LF. The 8-bit checks exercised the numbered BBS navigation. Downloading files on those three readers, telephone dial-in, and physical hardware remain unverified.
