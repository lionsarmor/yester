#!/usr/bin/env python3
"""Browse a Retro Page export CD in the owner's Windows 98 guest."""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


HERE = Path(__file__).resolve().parent
BUDDY = Path(os.environ.get('BUDDY_ROOT', Path.home() / 'Desktop/lionsarmor/BUDDY'))
DEFAULT_DISK = BUDDY / '.tools/windows98-vm/windows98-kvm-test.qcow2'


def qemu_runtime():
    qemu = BUDDY / '.tools/qemu-6.2/root'
    support = BUDDY / '.tools/qemu/root'
    binary = qemu / 'usr/bin/qemu-system-i386'
    env = os.environ.copy()
    if binary.is_file():
        libraries = [qemu / 'usr/lib/x86_64-linux-gnu', qemu / 'lib/x86_64-linux-gnu', support / 'usr/lib/x86_64-linux-gnu']
        if env.get('LD_LIBRARY_PATH'):
            libraries.append(env['LD_LIBRARY_PATH'])
        env['LD_LIBRARY_PATH'] = os.pathsep.join(map(str, libraries))
        env['QEMU_MODULE_DIR'] = str(qemu / 'usr/lib/x86_64-linux-gnu/qemu')
        bios = support / 'usr/share/seabios'
        firmware = ['-L', qemu / 'usr/share/qemu', '-L', bios, '-bios', bios / 'bios.bin']
        return binary, firmware, env
    binary = shutil.which('qemu-system-i386')
    if not binary:
        sys.exit('Install qemu-system-i386 or set BUDDY_ROOT to the local emulator installation.')
    return binary, [], env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--disk', type=Path, default=Path(os.environ.get('RETRO_PAGE_WIN98_DISK', DEFAULT_DISK)), help='installed Windows 98 qcow2 image')
    parser.add_argument('--export', type=Path, help='folder containing classic.html from an extracted website ZIP')
    parser.add_argument('--qmp', type=Path, help='optional unused local socket for QEMU test controls')
    parser.add_argument('--headless', action='store_true', help='omit the graphical window')
    args = parser.parse_args()
    if not args.disk.is_file():
        parser.error('Pass --disk with your installed Windows 98 qcow2 image.')
    if args.export and not (args.export / 'classic.html').is_file():
        parser.error('The export directory must contain classic.html.')
    if args.qmp and args.qmp.exists():
        parser.error('Choose an unused path for the QMP socket.')
    binary, firmware, env = qemu_runtime()
    with tempfile.TemporaryDirectory(prefix='retro-page-win98-') as temp:
        iso = HERE / 'sample-site.iso'
        if args.export:
            builder = shutil.which('genisoimage') or shutil.which('mkisofs')
            if not builder:
                parser.error('Install genisoimage or mkisofs to build a CD from another export.')
            iso = Path(temp) / 'site.iso'
            subprocess.run([builder, '-quiet', '-J', '-R', '-V', 'RETRO_PAGE', '-o', iso, args.export.resolve()], check=True)
        if not iso.is_file():
            parser.error('The sample-site.iso CD is missing. Supply an export folder with --export.')
        # QEMU parses commas in a drive path as option boundaries unless doubled.
        disk_path = str(args.disk.resolve()).replace(',', ',,')
        cd_path = str(iso.resolve()).replace(',', ',,')
        command = [binary, *firmware, '-name', 'Retro Page - Windows 98 browser lab',
                   '-machine', 'pc,acpi=off,hpet=off', '-accel', 'tcg', '-cpu', 'pentium2,-apic',
                   '-m', '64', '-vga', 'cirrus', '-boot', 'c', '-nic', 'none',
                   '-drive', f'file={disk_path},format=qcow2,if=ide,index=0,snapshot=on',
                   '-drive', f'file={cd_path},media=cdrom,readonly=on,if=ide,index=2',
                   '-display', 'none' if args.headless else 'gtk,gl=off,zoom-to-fit=on']
        if args.qmp:
            socket_path = str(args.qmp.resolve()).replace(',', ',,')
            command += ['-qmp', f'unix:{socket_path},server=on,wait=off']
        return subprocess.run(command, env=env).returncode


if __name__ == '__main__':
    sys.exit(main())
