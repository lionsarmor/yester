# Read YesterSites in Windows 3.1

Start a member’s live site in NCSA Mosaic 1.0 with Python 3.9+, DOSBox-X built with SLIRP networking, and your installed Windows 3.1 C: drive. Put the original NCSA Mosaic for Windows 1.0 archive (mosaic1.0.zip) and Trumpet Winsock 2.0b archive (twsk20b.zip) in a directory named media. The launcher verifies the archive checksums and starts Windows from a temporary copy of your installed drive.

    python3 launch-windows31.py switchboard-radio --guest /path/to/drive --media-dir media

Use --dosbox /path/to/dosbox-x if DOSBox-X is outside your PATH. On Windows use py in place of python3. The launcher takes the NE2000 packet driver from the pinned DOSBox-X source below on first use. To use your own verified copy, add --packet-driver /path/to/NE2000.COM.

To use an already-networked DOSBox-X guest with SLIRP, run the standalone gateway on your modern computer and open the following address in the guest.

    python3 legacy_gateway.py switchboard-radio --port 8077
    http://10.0.2.2:8077/INDEX.HTM

The host fetches each page or picture over verified HTTPS. Mosaic receives local HTTP, short image and page names, and script-free HTML. Open /BBS.HTM or /TEXT.HTM to read another edition. Every standalone gateway session serves one chosen member. Its HTTP service is read-only and binds to the host loopback interface.

To open an offline Retro Page export, supply the ZIP or the DOS directory as the first argument. Offline mode additionally needs the original MOZOCK.ZIP archive (named mozock.zip in the media directory). See launch-windows31.py for the verified SHA-256 values.

[Packet-driver source in DOSBox-X](https://github.com/joncampbell123/dosbox-x/blob/65529a66f6c360e736a4b07c729d7978a14118b9/src/builtin/ne2000bin.cpp)
