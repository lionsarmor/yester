# YesterSites creator release checks

November 21, 2026, Manila time. These checks used the live account service, web editor, public member subdomains, Grub, RSS and YESTER.

## Publish, reopen and restore

- A regular account published a three-page radio club and an unlisted workbench from a fresh Firefox profile. Each publishing receipt and My Sites entry linked to the corresponding member subdomain. Both addresses opened in a signed-out browser. [Listed radio club](https://switchboard-radio.yestersites.com/) · [Unlisted workbench](https://switchboard-workbench.yestersites.com/)
- In a second browser with empty local storage, the owner opened the radio club through **My Sites → Edit**. The top-level editor restored its three pages, editable headline, two home images, BBS menu and attachment, and mixed-media objects. The owner applied a new home-page intro through Properties and published. The receipt linked to the same subdomain, where the new line ends with “Reception confirmed.” Its generated headline downloaded as a PNG in the modern edition and as a GIF89a file in the classic edition. [Modern homepage](https://switchboard-radio.yestersites.com/modern.html) · [Classic homepage](https://switchboard-radio.yestersites.com/classic.html)
- Fresh sign-ins to Roddy's account in Firefox and Chromium both opened the saved Aircheck project with its three pages and three home images at the editor subdomain. [Retro Page](https://retropage.yestersites.com/)
- Roddy's founder editor published a one-line change to Pixel Club's diary. The public diary displayed that line, and the new backup differed from the original in exactly one member, `diary.html`. Restoring the prior version restored the diary and all 23 members. The before and after ZIPs were byte-identical, with SHA-256 `ef933aa0533605b123285ae28be2fed5a0deb52b83470dd56e0bd1037682eac7`. [Pixel Club diary](https://pixelclub.yestersites.com/diary.html)

## Finding a published site

Grub search results and the public RSS feed included Switchboard Radio Club at its canonical address. Both excluded Switchboard Workbench. YESTER's title lookup found Switchboard Radio Club at the same address and rejected the unlisted site's title. A direct URL continued to open the unlisted site. [Search Grub](https://yestersites.com/crawler/?q=Switchboard) · [RSS](https://yestersites-webring.jamesmweeksjr.chatgpt.site/api/feed.xml) · [YESTER](https://yestersites.com/browse/)

## Media, BBS and touch controls

Station Log contains an audio clip, native movie, custom HTML/CSS bulletin, Flash object and linked frame. The editor export and the published modern and phone editions each rendered one audio player, one video player and three embedded frames. The classic and text editions matched all five creator-written fallback labels and destinations. All four published editions also opened inside YESTER with the same players or fallback links. This comparison checked rendered controls, counts and fallback destinations. Audio playback was exercised separately. [Station Log](https://switchboard-radio.yestersites.com/page-58a621d271184680a75958472f88289f.html) · [Phone player screenshot](ring-phone-member-player.png) · [Classic fallback screenshot](ring-classic-member-links.png)

An anonymous BBS caller posted a one-liner. A second caller with a fresh session read the line. Command **1** opened Station Log, **F** downloaded the creator's 45-byte `RADIO.BIN` with the expected filename and exact contents, and **D** opened the configured Pixel Club door. These tests exercised the public web BBS. [Open the 40-column BBS](https://switchboard-radio.yestersites.com/bbs/?page=home&columns=40)

In Chromium's Pixel 5 touch profile, a tap followed Station Log inside the member frame. A tap on the illustrated play control started audio and advanced playback time. Swiping inside the member page navigated to the next site, unloaded the playing document and left the outer player paused. Bookmark and Share preserved the exact Station Log URL. Both the saved bookmark and the copied link reopened that page. Physical handset testing remains separate. [Open Switchboard in YESTER](https://yestersites.com/browse/?url=https%3A%2F%2Fswitchboard-radio.yestersites.com%2F)

## Recovery, HTTPS and historical bookmarks

The production recovery form sent a reset from support@roddy.world to a dedicated test account. The message arrived in Proton Mail. Its link opened the password form, the new password signed in, the previous password failed, and opening the spent link returned HTTP 400.

The main homepage opens the editor at its verified HTTPS subdomain. Anonymous HTTP clients followed the historical Aircheck receipt, Pixel Club diary and both Switchboard addresses with a single 301 to a working member page. The diary redirect preserved the query string. The apex serves GitHub Pages through the Droplet, and Certbot successfully simulated renewal against its new webroot. [Editor](https://retropage.yestersites.com/) · [Historical diary bookmark](https://yestersites.com/members/pixelclub/diary.html)
