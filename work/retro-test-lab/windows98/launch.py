#!/usr/bin/env python3
"""Use the owner's Windows 98 image with a private write overlay and a local export CD."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

here = Path(__file__).resolve().parent
buddy = Path(os.environ.get("BUDDY_ROOT", str(Path.home() / "Desktop/lionsarmor/BUDDY")))
tools = buddy / ".tools/qemu/root"
qemu = buddy / ".tools/qemu-6.2/root"
bios = tools / "usr/share/seabios"
parser = argparse.ArgumentParser()
parser.add_argument("--headless",action="store_true")
parser.add_argument("--export",type=Path,default=here.parents[1]/"preview-qa/after")
args=parser.parse_args()
guest=Path(os.environ.get("RETRO_PAGE_WIN98_DISK",str(buddy / ".tools/windows98-vm/windows98-kvm-test.qcow2")))
if not guest.is_file(): sys.exit("Set RETRO_PAGE_WIN98_DISK to an installed Windows 98 qcow2 disk.")
env=dict(os.environ,LD_LIBRARY_PATH=str(qemu/"usr/lib/x86_64-linux-gnu")+":"+str(qemu/"lib/x86_64-linux-gnu")+":"+str(tools/"usr/lib/x86_64-linux-gnu"),QEMU_MODULE_DIR=str(qemu/"usr/lib/x86_64-linux-gnu/qemu"))
overlay=here/"local-overlay.qcow2"
if not overlay.exists():
 subprocess.run([tools/"usr/bin/qemu-img","create","-f","qcow2","-F","qcow2","-b",guest.resolve(),overlay],env=env,check=True)
if not (args.export/"classic.html").is_file(): sys.exit("Pass --export with the extracted Retro Page website ZIP.")
iso=here/"export.iso"
subprocess.run(["genisoimage","-quiet","-J","-R","-V","RETRO_PAGE","-o",iso,args.export],check=True)
sock=Path(os.environ.get("XDG_RUNTIME_DIR","/tmp"))/"retro-page-win98.qmp"
args2=[str(qemu/"usr/bin/qemu-system-i386"),"-name","Retro Page — Windows 98 browser lab","-machine","pc,acpi=off,hpet=off","-accel","tcg","-cpu","pentium2,-apic","-m","64","-L",str(qemu/"usr/share/qemu"),"-L",str(bios),"-bios",str(bios/"bios.bin"),"-vga","cirrus","-drive",f"file={overlay},format=qcow2,if=ide,index=0","-drive",f"file={iso},media=cdrom,readonly=on,if=ide,index=2","-nic","none","-boot","c","-qmp",f"unix:{sock},server=on,wait=off","-display","none" if args.headless else "gtk,gl=off,zoom-to-fit=on"]
os.execve(args2[0],args2,env)
