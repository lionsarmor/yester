# YESTER 0.2 Android device review

The device is an Android 15 emulator running Android System WebView 124.0.6367.219. Phone captures use a 720 × 1440 viewport at 280 dpi. The test uses an isolated, signed-out Android user and the ordinary release APK. All member pages load over the network from their public HTTPS subdomains.

[Fourteen frames on Quarter Moon Arcade](frame-cabinet.jpg) · [Web browser parity checklist](web-parity.md) · [Per-case observations](device-results.jsonl)

Each full-size picture in the frames, phone and tablet directories is an Android screenshot. The contact sheet crops the bottom of each screenshot and adds its frame name.

## Scope

The emulator can verify WebView browsing, physical-key events, rotation, native sharing and Android audio player lifecycle. A physical phone, Bluetooth gamepad, iPhone Simulator and iOS device were unavailable for this session. Hardware latency, actual handset speaker output and iOS behavior require separate device checks.

## Verified behavior

| Android case | Observed result |
| --- | --- |
| Theme cabinet | Applied all 14 frames, one after the other, on the same live Quarter Moon Arcade homepage. Each full-size capture shows the actual artwork and controls. |
| Pond Post | Entered the game room through the homepage link and started the cartridge. Fullscreen stayed inside the YESTER activity. Rotating yielded a 1440 × 720 game, and exiting returned to the same game-room address. |
| Outside navigation | Entered example.org from the game room. Android Back restored the interior URL. Forward reopened the outside site. At the end of history it became Next. A grip swipe then discovered a listed member page. |
| Bookmarks and native sharing | Saved a room address containing a query and fragment. Tools showed Saved. Android Sharesheet displayed the complete URL. Reopening the bookmark after clearing the travel log preserved both the query and fragment. |
| Privacy and startup | Disabled travel logging. The cleared log was empty, bookmarks remained available, and the recording preference remained disabled after restart. A settled visit reopened at the exact room URL with quiet startup and the Contact Sheet frame retained. |
| Creator tools | Opened the live Retro Page editor from Settings. The Browse key returned to the saved game-room URL. |
| Release regressions | The first build forcibly reopened the grip when idle hiding was disabled. Selecting Resume on an already open page could lose that page on an immediate force-stop. Both regression tests passed in 0.2.1. |

The all-frame captures and game/round-trip checks were made on signed build 0.2.0 (Android version code 2). The cabinet specimen, manual fold, immediate resume and final device checks use signed build 0.2.1 (version code 3). Its SHA-256 is `cb704071e7b80bf4501e082e90fecb097a297ddb13dd882de7dada02e0d5fddc`.

[DeskSet and Cable Guide across four live member homepages](member-sites.jpg) · [Tablet Settings](tablet/settings.png) · [Folded grip](phone/folded.png) · [Tools](phone/tools.png) · [Fullscreen game in landscape](phone/game-landscape.png) · [Native share sheet](phone/share.png)

The four site comparisons use 0.2.1. At 1200 × 1920 and 240 dpi, the tablet displayed the settings sections alongside the active navigation panel. At phone width those sections drill down.

The active audio check used a loopback page playing a continuous 660 Hz Web Audio tone. Android reported the same active AAudio player before and after changing frame. Mute changed to Unmute, and swiping to a live site disposed the original audio player. This measures the app's playback lifecycle separately from physical speaker output.

## Final Android build

Signed APK **0.2.2**, version code **4**, SHA-256 `cee7edeef34c9fda406486819bf9ad8dab44236c6c4af74e08b549ce6150ef50`. This build upgraded the installed app in place.

- An unavailable domain displayed the themed recovery panel. **Discover another site** opened a live member site. In a second test, an endpoint was brought back online after the error. **Try again** recovered the full original URL, including its query and fragment. [Connection error](phone/connection-error.png)
- A nonsensical Grub search displayed its no-match message. A long game-room URL retained its entire query and fragment in the address editor. The Contact Sheet library displayed a deliberate fallback for an outside page without artwork. [Empty search](phone/empty-search.png) · [Long address](phone/long-address.png) · [Artwork fallback](phone/library-fallback.png)
- Phone cabinet specimens and the tablet’s two-pane settings were captured again after the final upgrade. [Phone cabinet](phone/cabinet.png) · [Tablet homepage](tablet/arcade.png) · [Tablet Settings](tablet/settings.png)
- The same device independently measured YESTER’s internal digital sound from the 0.2.1 build. Android Screen Recorder was restricted to YESTER and device audio. PCM amplitude fell from 6,748 RMS to 0.29 on mute, rose to 5,227 after unmute, and stayed at 0.29 for 18 seconds after discovery. [Audio measurement](audio-measurement.json) · [Sound](phone/sound-active.png) · [Muted](phone/sound-muted.png)
- The Stop button appeared during a deliberately slow response, and tapping it restored Reload. The high-contrast preference visibly changed the dock. [Dock states](dock-closeups.jpg) · [High contrast](phone/contrast.png)

## Remaining checks

Alt+L did not open the address field in the emulator using either injected Android key chords or the virtual hardware key combination. Tapping the address field worked. A physical keyboard test and investigation of Android key focus remain. No physical Android handset, iPhone, gamepad, screen-reader session or on-device iOS build was tested. The guestbook, publishing and account service belong to Retro Page and were not modified or release-tested in this browser pass.
