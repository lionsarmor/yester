# YESTER by RODDY

**[Download YESTER 0.2.2 for Android (.apk)](https://github.com/lionsarmor/yester/releases/download/v0.2.2/YESTER-0.2.2.apk)**

Open this page on your Android phone or tablet, download the APK, and tap it in Files to install. The signed preview runs on Android 7 and later and includes 32-bit and 64-bit builds for ARM and Intel. Open Quarter Moon Arcade, enter its game room, then swipe up from the bottom grip to discover another handmade site.

Try the [interactive Android preview](https://android.yestersites.com/) to explore the 14 browser frames. Compare the [design boards](outputs/yester-mobile/design-review) with the [frames photographed in the Android emulator](outputs/yester-mobile/review/frame-cabinet.jpg).

## The project

| Component | Source |
| --- | --- |
| YESTER phone browser for Android and iOS | [Mobile app and device tests](work/yester-mobile) |
| YesterSites homepage, member showcases, Grub and the web browser | [YesterSites](https://github.com/lionsarmor/yestersites) |
| Retro Page web editor, objects, publishing UI and BBS screen painter | [Retro Page](https://github.com/lionsarmor/retro-page) |
| Retro Page desktop editor and installers | [Desktop app](work/desktop-app) · [Debian packaging](work/desktop-packaging) · [Windows packaging](work/winpkg) |
| Member publishing, accounts, directory, database migrations and subdomain gateway | [Member service](work/yestersites-edition) |
| Classic browser and 8-bit client testing | [Retro test lab](work/retro-test-lab) · [Guest readers and gateways](outputs/Retro-Page-test-lab) |

Clone the complete project, including the pinned website and editor repositories.

```sh
git clone --recurse-submodules https://github.com/lionsarmor/yester.git
```

## Testing

- **Android emulator on Linux.** With an Android virtual device named `YESTER_Pixel`, run `work/yester-mobile/scripts/launch-apk.sh /path/to/YESTER-0.2.2.apk`. The launcher installs the downloaded release and opens it on that device.
- **Mobile development.** In `work/yester-mobile`, run `npm ci`, `npm test` and `npm run typecheck`. See the [mobile README](work/yester-mobile/README.md) for Expo and iPhone simulator instructions.
- **Member service.** Run `python3 work/yestersites-edition/scripts/build.py` to assemble the Worker. Its database binding is `DB`. Supply your own deployment settings and credentials. Optional build-time variables `FOUNDER_EMAIL_SHA256` and `FOUNDER_ACTIVATION_SHA256` enable the founder claim flow for your installation.
