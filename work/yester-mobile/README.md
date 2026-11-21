# YESTER by RODDY

A phone browser for YesterSites. Discover a listed member homepage, follow a link, save the exact page, or swipe up from the bottom grip to discover another member. The address field opens the full URL. Tap the grip to bring back the controls.

Swipe slowly left on the grip or on a free patch of a page in the phone app to uncover the next destination. Pull back before releasing to keep reading. A quick left flick opens the destination immediately. Hold still briefly and then drag in either direction to open a page as soon as the indicator reaches the end of the scale. Right goes back one page. Left uses Forward history first, then the current discovery mode. Links, form controls, media, and games keep their own touch input.

Listed member HTML pages have a silent, script-free page preview. Other destinations show their title and address until opened. In the web demo, use the grip for a continuous peek across iframe boundaries. Settings → Navigation → Swipe to browse turns gestures off.

## Run the app

Install Node 24 and the dependencies with `npm ci`. The app uses Expo SDK 58, React Native and the platform WebView.

- **Android on Linux, Windows or macOS.** In Android Studio Device Manager create a Pixel virtual device with a Google APIs system image. For this project the test target is Android 15 (API 35). Start it and run `npx expo start --go --android`. On Linux or macOS, `scripts/pixel.sh` launches the named YESTER_Pixel device and opens the installed APK. Set YESTER_DEV=1 to use Expo Go for development.
- **iPhone on macOS.** Install Xcode with an iOS Simulator runtime, start an iPhone, then run `npx expo start --go --ios`.
- **Native development builds.** Run `npm run android` or, on a Mac, `npm run ios`. These commands generate the native project and install YESTER on the selected device. Expo Go is useful for checking interaction before building a standalone binary.
- **Checks.** Run `npm test`, `npm run typecheck`, and `npx expo export --platform all` to exercise the browser logic and compile both bundles.

## Frame cabinet

Tools → Settings → Frame cabinet lets you try fifteen browser frames using the approved artwork. Apply a frame to keep it on this device. Use a native build to test per-site media controls. Expo Go lacks the YESTER native module. [Try the interactive Android preview](https://android.yestersites.com/).

## Live integrations

Discover uses the public Grub directory and its playable filter. Ring follows published member slugs in order. An outside link retains the originating member for ring navigation. Bookmarks, recent pages and settings live on the device. Settings → Creator tools opens the production Retro Page editor for its regular account, project and publishing flows. Bookmarks can include outside pages. Games and videos use their site's own controls and the device WebView's fullscreen support.

## Device acceptance trip

1. Start signed out. Open Quarter Moon Arcade's game room. Enter and leave fullscreen, rotate and use the touch controls.
2. Open an outside page, then use Back, Forward and Android system Back. Confirm the address field shows the full path of each page.
3. Save an interior page, share it, kill and reopen the app, then return through Library. Compare the exact URL.
4. Start audio. Swipe up on the grip. Confirm silence from the old page and that swiping within a game or diary stays on that site.
5. Switch to Play and Ring. Open Settings → Creator tools → Make your own site, sign into a test account and publish an edit to an owned test site. Reopen its public URL in YESTER.
6. Repeat on an iPhone and Android phone with a physical controller for simultaneous input, pairing and media interruptions.

## Android tablet preview

The standalone preview APK includes the JavaScript bundle and browser controls. Copy the APK to the tablet and open it from Files. If Android asks, allow that file manager to install this app. The published member sites, Grub and Retro Page require an internet connection. A running Metro server and an Expo account are unnecessary for the standalone build.

## Previous Android 0.1 verification

On the Pixel 6 virtual device running Android 15, YESTER opened the live Quarter Moon Arcade homepage and its Pond Post game room. The game entered native fullscreen and Android Back returned to the same room. An outside address opened inside YESTER. System Back and Forward traversed the room and outside page, Next discovered another member, Library retained the full game-room URL, and Create opened the production Retro Page editor. A grip swipe replaced the game WebView with one serving Switchboard Radio.

Physical controller input, tablet hardware and the iPhone runtime still need device testing.

## Shared Android and web alpha

The Android showcase starts the web build of this app at https://yestersites.com/yester/?start=arcade. Both targets import App.tsx, the frame cabinet, library, settings, navigation and discovery. From this directory, run `npm run sync:demo` with the sibling GitHub Pages checkout present when releasing an app change. Commit the resulting Pages export with the shared source.

Android uses its system WebView. The web build uses an isolated iframe for live member sites and the YesterSites navigation bridge. The editor and account flows open in a first-party tab. External sites control whether they accept embedding. Storage and bookmarks belong to the local browser or Android installation.
