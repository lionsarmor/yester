# YesterSites Emulator Lab

Double-click **YesterSites Emulator Lab** on this workstation. Enter a published member name such as `firefly-film-club`, select a computer, and choose **Launch machine**. You can also paste the site's full homepage address. Close the emulator window to finish its session.

| Computer | Guest software | Edition |
| --- | --- | --- |
| Windows 3.1 | NCSA Mosaic 1.0 in DOSBox-X, Trumpet Winsock and an emulated NE2000 card | Classic HTML with short image and page filenames |
| Windows 98 SE | Internet Explorer 5 in QEMU, using the guest's loopback HTTP and COM1 adapter | Classic HTML, graphics and links |
| Commodore 64 | Native terminal in VICE, connected through SwiftLink | 40-column BBS |
| Commander X16 | Native 65C02 reader in the Lionsarmor Wi-Fi emulator | 40-column BBS, parsed in guest memory |
| Spectrum Next | Native Z80 reader in ZEsarUX TBBlue, using an emulated UART | 32-column BBS |

The Windows browsers open the creator's classic home page. Use the links on the page to visit the text and BBS editions. The host gateway negotiates HTTPS with the selected public member. Windows 3.1 uses short filenames for the guest browser. Windows 98 uses a temporary copy of its installed disk for each session.

On the 8-bit machines, press a numbered key for the matching BBS screen. **0** and **H** go home. **N** and **P** scroll the current screen. These readers support menus and text. File uploads, posting, and telephone dial-in require different clients. The supplied X16 emulator's network card returns up to 8 KiB per request.

## From a terminal

```sh
./launch.py x16 firefly-film-club
./launch.py win31 https://switchboard-radio.yestersites.com/
```

Machine IDs are `win31`, `win98`, `c64`, `x16`, and `next`. The launcher uses this workstation's existing emulator installations and licensed guest media. Session request logs normally go in `~/.local/state/yestersites/emulator-lab/`. Use `--evidence <directory>` to choose the location.

To check a multi-screen reference site on private displays, pass an unused evidence directory. This command boots each guest, saves its rendered screen, and records the public URLs it actually fetched. The 8-bit check also presses **1** and **0** and verifies the destination of each guest request.

```sh
/usr/bin/python3 check-live.py firefly-film-club /tmp/firefly-review
```

Append one or more machine IDs to run a subset. Retained release evidence lives under `production-evidence/`.
