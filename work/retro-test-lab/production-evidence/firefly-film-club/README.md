# Firefly Film Club in five emulators

Tested November 21, 2026 on the public [Firefly Film Club](https://firefly-film-club.yestersites.com/) member site. These are screenshots of guest operating systems and native readers. Each request log records the public HTTPS response fetched on behalf of that guest.

| Guest | Confirmed in the live site | Evidence |
| --- | --- | --- |
| NCSA Mosaic 1.0 on Windows 3.1 | Loaded the film-club banner, the Market Street video poster, the fallback caption and the lamp-desk link. The gateway substitutes a readable apostrophe and separator for punctuation Mosaic could not display. | [Guest screen](win31/home.png) · [HTML and GIF requests](win31/requests.tsv) |
| Internet Explorer 5 on Windows 98 SE | The member address appeared in the browser. The club banner, camera still, fallback caption and projection notes rendered over the guest's COM1 HTTP adapter. | [Guest screen](win98/home.png) · [HTML and GIF requests](win98/requests.tsv) |
| Commodore 64 in VICE | Loaded the 40-column BBS using SwiftLink. Pressing **1** fetched the streetcar bulletin. Pressing **0** fetched the club homepage again. | [Home](c64/home.png) · [Bulletin](c64/first-screen.png) · [Return](c64/home-return.png) · [Requests](c64/requests.jsonl) |
| Commander X16 | The native 65C02 reader issued HTTPS requests through the Lionsarmor emulator's Wi-Fi UART and displayed the 40-column bulletin. **1** opened the bulletin, **0** returned home. | [Home](x16/home.png) · [Bulletin](x16/first-screen.png) · [Return](x16/home-return.png) · [Requests](x16/requests.tsv) |
| Spectrum Next in ZEsarUX | The native Z80 reader received the 32-column BBS via its UART. The guest requested the bulletin with **1** and the homepage with **0**. | [Home](next/home.png) · [Bulletin](next/first-screen.png) · [Return](next/home-return.png) · [Requests](next/requests.jsonl) |

The [desktop shortcut](desktop-launcher.png) opened the machine and member chooser on this workstation. ModemManager reported no modem, and the USB inventory had no phone, USB serial adapter or retro hardware. Physical-device and telephone dial-in checks remain open.

During the first run the C64's bulletin request timed out and Windows 98 paused at guest startup dialogs. The retained receipts cover the successful reruns after increasing the reader timeout and handling the local Windows startup dialogs.
