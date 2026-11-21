# Retro Pages on four 8-bit machines

The sample is Late Night Signal, built from the desktop editor’s actual 32-column terminal output. The keyboard journey tested in each machine was **1** for Station Log, **H** for Home, then **2** for Links. The content includes the radio tower’s alternative text. On the Commodore targets, letters use the uppercase character set.

| Machine | Test software | Guest file | Transport |
| --- | --- | --- | --- |
| Commodore 64 | VICE 3.7.1, cycle-accurate x64sc | SIGNAL64.PRG | Offline native BASIC reader |
| Commodore 64 | VICE 3.7.1, emulated SwiftLink at $DE00 | LIVE64.PRG | Interactive local TCP-to-serial connection |
| Commander X16 | Commander X16 emulator r49 Pyrite, 40-column video mode | SIGNAL16.PRG | Offline native BASIC reader |
| ZX Spectrum Next | ZEsarUX 13.0, TBBlue model in fast-boot mode | SIGNAL.NEX | Offline native Z80 reader |
| ZX Spectrum 48K | ZEsarUX 13.0, 48K model | SIGNAL48.SNA | Offline Z80 reader loaded from a 48K snapshot |

## Open a machine

In this folder, run one of these commands. To close an emulator, close its window. The launcher uses the workstation’s existing BUDDY emulator and ROM locations and the project’s private host tools. Keep this folder in its current project location.

```sh
python3 launch.py c64
python3 launch.py x16
python3 launch.py next
python3 launch.py spectrum48
python3 c64-gateway.py
```

The live C64 command starts a temporary loopback listener and the emulator together. The guest sends a readiness byte, receives the first screen, and transmits each navigation key over its emulated serial cartridge. There is no external network service or modem requirement. This tests two-way terminal traffic on this workstation. Browser HTML, public hosting and telephone dial-in require separate tests.

The four offline files in `media` contain three linked pages. The lab prepares two Spectrum binaries that use the same 32-column ULA display and the machine’s character ROM. The Next uses an actual Next NEX loader and the 48K uses its own machine mode and snapshot. The files are local transfer editions. Physical machines have not been tested.

## Test another saved project

From the main project folder, regenerate the media with the following command. The launchers and the serial gateway will then use the new fixture. Omitting `--project` restores Late Night Signal.

```sh
work/desktop-qa/python work/retro-test-lab/8bit/build-readers.py --project /path/to/site.yst
```

The native lab reader provides number keys 1–9 for internal links on a page, H for Home, and N/P to turn long pages. It supports up to 18 generated screens, subject to the 16 KiB Next code-and-content bank. The downloads and guest media are separate from Retro Pages' standard graphical and text HTML exports.

## Evidence

The `evidence` directory has original emulator screenshots for all four keyboard steps, a live serial request log, and verified screenshot hashes. Home rendered the same guest pixels after navigating away and back. The test compares the C64 guest area to omit VICE’s changing host speed indicator.

From the main project folder, these commands reproduce the tests using private virtual X displays. All emulators and temporary listeners close after the capture.

```sh
python3 work/retro-test-lab/8bit/smoke.py
python3 work/retro-test-lab/8bit/smoke-serial.py
python3 work/retro-test-lab/8bit/verify_evidence.py
```

[VICE](https://vice-emu.sourceforge.io/) · [Commander X16 emulator](https://github.com/X16Community/x16-emulator) · [ZEsarUX](https://github.com/chernandezba/zesarux) · [Next executable file format](https://wiki.specnext.dev/NEX_file_format)
