import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { WebViewNavigation } from "react-native-webview";
import WebView from "./src/BrowserSurface";
import { arcadeDemo } from "./src/launchAddress";
import * as Clipboard from "expo-clipboard";
import {
  LibraryRecord,
  Thumbnail,
  Art,
  c,
  frames,
  Key,
  Row,
  type Frame,
} from "./src/chrome";
import {
  directory,
  EDITOR,
  homepage,
  memberOf,
  nextSite,
  SERVICE,
  webURL,
  type Mode,
  type Site,
  type Visit,
} from "./src/discovery";
import { Settings } from "./src/Settings";
import { nativeControls } from "./src/nativeControls";
import type { FrameAction } from "./src/frames";
import { Trail, type Entry } from "./src/trail";
import { useLibrary } from "./src/useLibrary";

type Panel = "Menu" | "Address" | "Discover" | "Library" | "Settings";
const starterArt: Record<string, string> = {
  "quarter-moon-arcade": "free-play",
  "pocket-bog": "pocket-bog",
  signal: "late-night",
  pixelclub: "player-two",
};
const thumbnail = (site: Site) =>
  starterArt[site.slug]
    ? "https://yestersites.com/retropage/assets/starters/" +
      starterArt[site.slug] +
      ".webp"
    : homepage(site) + "favicon.ico";
const starter = "https://quarter-moon-arcade.yestersites.com/";
const editorForms = `if(location.origin === new URL(${JSON.stringify(EDITOR)}).origin){
  const submit = HTMLFormElement.prototype.submit;
  const target = form => { if(new URL(form.action, location.href).href === ${JSON.stringify(SERVICE + "/api/editor/handoff")}) form.target = '_self'; };
  HTMLFormElement.prototype.submit = function(){target(this); return submit.call(this);};
  document.addEventListener('submit',e=>target(e.target),true);
} true;`;
function Browser() {
  const lib = useLibrary();
  const prefs = lib.data.prefs;
  const [preview, setPreview] = useState<Frame | null>(null),
    [section, setSection] = useState("");
  const [quiet, setQuiet] = useState(false),
    [soundAvailable, setSoundAvailable] = useState(false);
  const [handle, setHandle] = useState(""),
    [started, setStarted] = useState(false);
  const startedRef = useRef(false),
    desiredMute = useRef(false),
    audioRequest = useRef(0),
    fallback = useRef("");
  const [fullscreen, setFullscreen] = useState(false);
  const [playFilter, setPlayFilter] = useState(false);

  const trail = useRef(new Trail()).current;
  const sequence = useRef(1),
    generation = useRef(1);
  const [document, setDocument] = useState({ url: starter, key: 1 });
  const [url, setUrl] = useState(starter),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null),
    [editor, setEditor] = useState(false);
  const selectedFrame =
    frames[
      panel === "Settings" && section === "Frame cabinet" && preview
        ? preview
        : prefs.frame
    ];
  const p = prefs.contrast
    ? {
        ...selectedFrame,
        ink: "#101010",
        paper: "#ffffff",
        surface: "#fff",
        keyInks: ["#111", "#111", "#111", "#111"],
        displayInk: "#111",
        contrast: true,
      }
    : selectedFrame;
  const [address, setAddress] = useState(""),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const [visible, setVisible] = useState(true),
    [activity, setActivity] = useState(0),
    [held, setHeld] = useState(false);
  const [recentTab, setRecentTab] = useState(false),
    [sites, setSites] = useState<Site[]>([]),
    [catalogState, setCatalogState] = useState("Loading Grub…"),
    [refresh, setRefresh] = useState(0);
  const [native, setNative] = useState({ back: false, forward: false });
  const view = useRef<WebView<object>>(null),
    gripY = useRef(0),
    first = useRef(true);
  const seen = useRef<Record<Mode, Set<string>>>({
    Shuffle: new Set(),
    Play: new Set(),
    Ring: new Set(),
  });
  const anchor = useRef<string | null>("quarter-moon-arcade");
  const [, redraw] = useState(0);
  if (!trail.current)
    trail.push({
      url: starter,
      title: "Quarter Moon Arcade",
      member: anchor.current,
      session: 1,
    });
  const active = trail.current;
  const source = React.useMemo(() => ({ uri: document.url }), [document]);

  function wake() {
    setVisible(true);
    setActivity((n) => n + 1);
  }
  function show(which: Panel) {
    setPreview(null);
    setSection("");
    wake();
    setNotice("");
    setPanel(which);
  }
  useEffect(() => {
    if (Platform.OS === "web") return;
    AccessibilityInfo.isScreenReaderEnabled().then(setIsReading);
    const sub = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsReading,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (held) return;
    if (Platform.OS === "web" && globalThis.document?.activeElement?.matches("input,textarea,button:focus-visible,[role=button]:focus-visible")) return;
    if (isReading || panel || editor) {
      setVisible(true);
      return;
    }
    if (!prefs.autoHide) return;
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [isReading, prefs.autoHide, panel, held, editor, activity]);
  useEffect(() => {
    let live = true;
    setCatalogState("Loading Grub…");
    Promise.allSettled([
      directory(),
      directory(true).then((rows) => {
        if (live)
          setSites((old) =>
            old.length ? old : rows.map((s) => ({ ...s, playable: true })),
          );
        return rows;
      }),
    ]).then(([all, play]) => {
      if (!live) return;
      if (all.status === "fulfilled") {
        const games = new Set(
          play.status === "fulfilled" ? play.value.map((s) => s.slug) : [],
        );
        setSites(
          all.value.map((s) => ({
            ...s,
            playable: s.playable || games.has(s.slug),
          })),
        );
        setCatalogState(all.value.length ? "" : "No sites are listed yet.");
      } else setCatalogState("Full directory unavailable. Tap to retry.");
    });
    return () => {
      live = false;
    };
  }, [refresh]);
  const suggestion = React.useMemo(
    () =>
      nextSite(
        sites,
        prefs.mode,
        active.member,
        new Set(seen.current[prefs.mode]),
      ),
    [sites, prefs.mode, active.member, active.session],
  );
  useEffect(() => {
    if (suggestion) Image.prefetch(thumbnail(suggestion)).catch(() => {});
  }, [suggestion]);
  async function configureAudio(mute: boolean) {
    const req = ++audioRequest.current,
      key = generation.current;
    desiredMute.current = mute;
    const ok = await nativeControls
      ?.configure(mute, prefs.tapForSound)
      .catch(() => false);
    if (key !== generation.current || req !== audioRequest.current) return;
    setSoundAvailable(!!ok);
    setQuiet(!!ok && mute);
  }
  function mountPage(entry: Entry) {
    desiredMute.current = prefs.quiet;
    setQuiet(false);
    setSoundAvailable(false);
    setFullscreen(false);
    generation.current++;
    first.current = true;
    setEditor(false);
    setPanel(null);
    setBusy(true);
    setError("");
    setUrl(entry.url);
    setNative({ back: false, forward: false });
    setDocument({ key: generation.current, url: entry.url });
    wake();
  }
  function visit(href: string, title?: string, member?: string | null) {
    fallback.current = "";
    const target = webURL(href);
    if (!target) return;
    const entry = {
      url: target,
      title: title || new URL(target).hostname,
      member: memberOf(target) || member || anchor.current,
      session: ++sequence.current,
    };
    anchor.current = entry.member;
    trail.push(entry);
    mountPage(entry);
  }
  function openMember(site: Site) {
    const home = homepage(site);
    visit(prefs.textEdition ? home + "text.html" : home, site.title, site.slug);
    fallback.current = prefs.textEdition ? home : "";
  }
  useEffect(() => {
    if (!lib.ready || startedRef.current) return;
    function start(site?: Site) {
      if (startedRef.current) return;
      startedRef.current = true;
      const previous = !arcadeDemo && prefs.resume ? lib.data.last : null;
      const home = site ? homepage(site) : starter;
      const target = previous || {
        url: prefs.textEdition ? home + "text.html" : home,
        title: site?.title || "Quarter Moon Arcade",
        member: memberOf(home),
      };
      trail.entries = [];
      trail.index = -1;
      const entry = { ...target, session: ++sequence.current };
      trail.push(entry);
      anchor.current = entry.member;
      mountPage(entry);
      fallback.current = !previous && prefs.textEdition ? home : "";
      setVisible(!prefs.folded);
      setStarted(true);
    }
    if (arcadeDemo || (prefs.resume && lib.data.last)) {
      start();
      return;
    }
    if (sites.length) {
      start(nextSite(sites, prefs.mode, null, new Set()));
      return;
    }
    const timer = setTimeout(() => start(), 4500);
    return () => clearTimeout(timer);
  }, [lib.ready, sites]);
  function discover(mode: Mode = prefs.mode) {
    const history = seen.current[mode];
    if (anchor.current) history.add(anchor.current);
    const picked = nextSite(sites, mode, anchor.current, history);
    const site = mode === prefs.mode && suggestion ? suggestion : picked;
    if (!site) {
      show("Discover");
      setNotice("No matching sites are available yet.");
      return;
    }
    history.add(site.slug);
    lib.preference("mode", mode);
    openMember(site);
  }
  function travel(direction: -1 | 1) {
    const previous = trail.current,
      target = trail.move(direction);
    if (!target) {
      if (direction === 1) discover();
      return;
    }
    anchor.current = target.member;
    if (
      target.session === previous.session &&
      (direction < 0 ? native.back : native.forward)
    ) {
      if (direction < 0) view.current?.goBack();
      else view.current?.goForward();
      setUrl(target.url);
      redraw((n) => n + 1);
      wake();
    } else mountPage(target);
  }
  function nav(state: WebViewNavigation, key: number) {
    if (key !== generation.current) return;
    const href = webURL(state.url);
    if (!href) return;
    setUrl(href);
    setBusy(state.loading);
    setNative({ back: state.canGoBack, forward: state.canGoForward });
    if (editor || state.loading) return;
    const member = memberOf(href) || trail.current.member;
    anchor.current = member;
    const entry = {
      url: href,
      title: state.title || new URL(href).hostname,
      member,
      session: trail.current.session,
    };
    if (first.current) {
      trail.entries[trail.index] = entry;
      first.current = false;
    } else trail.push(entry);
    if (lib.ready) lib.recent(entry);
    redraw((n) => n + 1);
  }
  function closeEditor() {
    mountPage(trail.current);
  }
  function back() {
    if (panel === "Settings" && section) {
      setSection("");
      setPreview(null);
      return true;
    }
    if (panel) {
      setPanel(null);
      wake();
      return true;
    }
    if (fullscreen) {
      setFullscreen(false);
      wake();
      return true;
    }
    if (editor) {
      if (native.back) view.current?.goBack();
      else closeEditor();
      return true;
    }
    if (trail.back) {
      travel(-1);
      return true;
    }
    return false;
  }
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", back);
    return () => sub.remove();
  });
  function create(startUrl: string = EDITOR) {
    desiredMute.current = false;
    setFullscreen(false);
    generation.current++;
    setDocument({ key: generation.current, url: startUrl });
    setEditor(true);
    setUrl(startUrl);
    setNative({ back: false, forward: false });
    setBusy(true);
    setError("");
    setPanel(null);
    wake();
  }
  function retryPage() {
    if (editor) create(url);
    else if (trail.current.url === url) mountPage(trail.current);
    else visit(url);
  }
  function routePopup(href: string) {
    if (
      editor &&
      [new URL(EDITOR).origin, SERVICE].includes(new URL(href).origin)
    ) {
      view.current?.injectJavaScript(
        "location.assign(" + JSON.stringify(href) + ");true;",
      );
    } else visit(href);
  }
  useEffect(() => {
    const listener = nativeControls?.addListener("shortcut", ({ action }) => {
      if (action === "address") typeAddress();
      else if (action === "dismiss") back();
      else if (action === "grip") {
        setFullscreen(false);
        setVisible((current) => !current);
        setActivity((n) => n + 1);
      } else if (!panel) {
        if (action === "back") back();
        else if (action === "forward") travel(1);
      }
    });
    return () => listener?.remove();
  });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleExit = () => {
      if (!globalThis.document.fullscreenElement) { setFullscreen(false); wake(); }
    };
    globalThis.document.addEventListener("fullscreenchange", handleExit);
    return () => globalThis.document.removeEventListener("fullscreenchange", handleExit);
  }, []);
  function typeAddress() {
    setAddress(url);
    show("Address");
  }
  function go() {
    const target = webURL(address, true);
    if (target) visit(target);
    else setNotice("Enter a web address such as yestersites.com.");
  }
  const row = (
    label: string,
    action: () => void,
    detail?: string,
    selected = false,
    icon?: FrameAction,
  ) => (
    <Row
      key={label}
      p={p}
      label={label}
      detail={detail}
      selected={selected}
      action={icon}
      onPress={action}
    />
  );
  const records = recentTab ? lib.data.recent : lib.data.marks;
  const results = sites.filter(
    (site) =>
      (!playFilter || site.playable) &&
      [site.title, site.slug, ...site.categories, ...site.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const current: Visit = {
    url,
    title: active.url === url ? active.title : new URL(url).hostname,
    member: memberOf(url) || active.member,
  };
  const saved = lib.data.marks.some((m) => m.url === url);
  return (
    <SafeAreaView style={[c.root, { backgroundColor: p.surface }]}>
      <View
        style={{ flex: 1 }}
        onTouchStart={() => setHeld(true)}
        onTouchCancel={() => setHeld(false)}
        onTouchEnd={() => {
          setHeld(false);
          setActivity((n) => n + 1);
        }}
      >
        {!started && (
          <View
            accessibilityLiveRegion="polite"
            style={[c.center, { backgroundColor: p.paper }]}
          >
            <Image
              source={p.icons.discover}
              resizeMode="contain"
              style={{ width: 40, height: 40 }}
            />
            <Text style={{ color: p.ink, fontSize: 18, fontWeight: "bold" }}>
              Opening the neighborhood…
            </Text>
          </View>
        )}
        {started && !error && (
          <WebView<object>
            key={document.key}
            ref={view}
            source={source}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={prefs.tapForSound}
            allowFileAccess={false}
            mixedContentMode="never"
            originWhitelist={["*"]}
            injectedJavaScript={
              editor
                ? editorForms +
                  ";if(location.origin===" +
                  JSON.stringify(SERVICE) +
                  "){if(location.pathname==='/account/' || location.pathname==='/signin/')window.ReactNativeWebView.postMessage(JSON.stringify({handle:document.querySelector('p b')?.textContent||''}));}true;"
                : undefined
            }
            onMessage={
              editor
                ? (e) => {
                    if (
                      webURL(e.nativeEvent.url) &&
                      new URL(e.nativeEvent.url).origin === SERVICE
                    ) {
                      try {
                        const h = JSON.parse(e.nativeEvent.data).handle;
                        if (
                          typeof h === "string" &&
                          /^[a-z0-9_-]{0,40}$/i.test(h)
                        )
                          setHandle(h);
                      } catch {}
                    }
                  }
                : undefined
            }
            onHttpError={(e) => {
              if (
                fallback.current &&
                e.nativeEvent.url === source.uri &&
                e.nativeEvent.statusCode >= 400
              ) {
                const home = fallback.current;
                visit(home);
              }
            }}

            onShouldStartLoadWithRequest={(req) => {
              if (req.url === "about:blank") return true;
              const target = webURL(req.url);
              if (!target) return false;
              if (
                editor &&
                req.isTopFrame &&
                ![
                  new URL(EDITOR).origin,
                  SERVICE,
                  "https://yestersites.com",
                ].includes(new URL(target).origin)
              ) {
                visit(target);
                return false;
              }
              return true;
            }}
            onOpenWindow={(e) => {
              const href = webURL(e.nativeEvent.targetUrl);
              if (href) routePopup(href);
            }}
            onNavigationStateChange={(n) => nav(n, document.key)}
            onLoadStart={() => {
              if (document.key === generation.current) {
                setBusy(true);
                void configureAudio(desiredMute.current);
              }
            }}
            onLoadEnd={() => {
              if (document.key === generation.current) {
                setBusy(false);
                void configureAudio(desiredMute.current);
              }
            }}
            onError={(event) => {
              event.preventDefault();
              if (document.key !== generation.current) return;
              const failedUrl = webURL(event.nativeEvent.url) || url;
              generation.current++;
              setBusy(false);
              setNative({ back: false, forward: false });
              setUrl(failedUrl);
              setError(
                event.nativeEvent.description ||
                  "The server could not be reached.",
              );
              wake();
            }}
          />
        )}
        {!!error && (
          <View
            style={[
              {
                flex: 1,
                justifyContent: "center",
                backgroundColor: p.paper,
                padding: 22,
              },
            ]}
          >
            <Image
              source={p.icons.reload}
              style={{ width: 34, height: 34 }}
              resizeMode="contain"
            />
            <Text
              accessibilityRole="header"
              style={{ color: p.ink, fontSize: 20, fontWeight: "bold" }}
            >
              Page unavailable
            </Text>
            <Text style={{ color: p.ink, marginVertical: 12 }}>{error}</Text>
            {row("Try again", retryPage, new URL(url).host, false, "reload")}
            {row("Discover another site", () => discover())}
          </View>
        )}
      </View>
      <View
        style={[c.bar, { backgroundColor: p.surface }]}
        onTouchStart={() => setHeld(true)}
        onTouchEnd={() => {
          setHeld(false);
          setActivity((n) => n + 1);
        }}
        onTouchCancel={() => setHeld(false)}
      >
        <Art source={p.housing} />
        <View
          accessible
          tabIndex={0}
          accessibilityRole="button"
          accessibilityLabel={
            fullscreen
              ? "Exit fullscreen"
              : "Browser grip. Show controls or swipe up for next site"
          }
          onAccessibilityTap={() => {
            setFullscreen(false);
            wake();
          }}
          style={c.grip}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            gripY.current = e.nativeEvent.pageY;
            setHeld(true);
          }}
          onResponderRelease={(e) => {
            setHeld(false);
            if (gripY.current - e.nativeEvent.pageY > 32) {
              if (!editor && prefs.gestures) discover();
            } else {
              if (fullscreen) {
                if (Platform.OS === "web" && globalThis.document.fullscreenElement) void globalThis.document.exitFullscreen().catch(() => {});
                setFullscreen(false);
                setVisible(true);
              } else setVisible(!visible);
              setActivity((n) => n + 1);
            }
          }}
          onResponderTerminate={() => setHeld(false)}
        >
          {fullscreen && (
            <Image
              source={p.icons.exitFullscreen}
              style={{ width: 18, height: 18, position: "absolute", right: 10 }}
            />
          )}
          <Image
            source={p.gripArt}
            resizeMode="stretch"
            style={{ width: 85, height: 13 }}
          />
        </View>
        {visible && !fullscreen && (
          <>
            <View style={c.strip}>
              <View style={[c.brandBox, { backgroundColor: p.dark }]}>
                {p.name === "County Dialer" && (
                  <View
                    accessible
                    accessibilityLabel={
                      busy ? "Exchange connecting" : "Line ready"
                    }
                    style={{
                      position: "absolute",
                      right: 3,
                      top: 3,
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      borderWidth: 1,
                      borderColor: "#2a2c1b",
                      backgroundColor: busy ? "#ffc856" : "#8ae676",
                    }}
                  />
                )}
                <Image
                  source={p.badge}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={c.brand}>{editor ? "CREATE" : "YESTER"}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Address"
                accessibilityHint={url}
                style={[c.address, { overflow: "hidden", borderColor: p.edge }]}
                onPress={typeAddress}
              >
                {!prefs.contrast && <Art source={p.addressArt} />}
                <Text
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  style={[
                    c.addrText,
                    { color: p.displayInk, marginHorizontal: 8 },
                  ]}
                >
                  {new URL(url).protocol === "http:" ? "http://" : ""}
                  {new URL(url).host}
                </Text>
              </Pressable>
            </View>
            <View style={c.keys}>
              <Key
                p={p}
                label="Back"
                glyph="◀"
                disabled={!editor && !trail.back}
                onPress={back}
              />
              <Key
                p={p}
                label={editor ? "Browse" : trail.forward ? "Forward" : "Next"}
                glyph={editor ? "⌂" : "▶"}
                onPress={() => (editor ? closeEditor() : travel(1))}
              />
              <Key
                p={p}
                label={busy ? "Stop" : "Reload"}
                glyph={busy ? "■" : "↻"}
                onPress={() => {
                  if (busy) {
                    view.current?.stopLoading();
                    setBusy(false);
                  } else if (error) retryPage();
                  else view.current?.reload();
                  wake();
                }}
              />
              <Key
                p={p}
                label="Tools"
                glyph="☰"
                onPress={() => show("Menu")}
              />
            </View>
          </>
        )}
      </View>
      {panel && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={c.backdrop}
        >
          <Pressable
            style={{ flex: 1 }}
            accessibilityLabel="Dismiss"
            onPress={() => setPanel(null)}
          />
          <View
            style={[
              c.sheet,
              { borderColor: p.edge, backgroundColor: p.surface },
            ]}
          >
            <View style={[c.head, { backgroundColor: p.dark }]}>
              <Image
                source={p.badge}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
              <Text style={[c.title, { flex: 1, marginLeft: 8 }]}>
                {panel === "Menu" ? "YESTER tools" : panel}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={() => setPanel(null)}
              >
                <Text style={[c.title, { padding: 6 }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ backgroundColor: p.paper }}
            >
              {panel === "Menu" && (
                <>
                  {row(
                    saved ? "Saved · Remove bookmark" : "Save page",
                    () => {
                      lib.bookmark(current);
                      show("Library");
                      setRecentTab(false);
                    },
                    current.title,
                    saved,
                    saved ? "saved" : "save",
                  )}
                  {row(
                    Platform.OS === "ios"
                      ? quiet
                        ? "Resume site media"
                        : "Suspend site media"
                      : quiet
                        ? "Unmute site"
                        : "Mute site",
                    () => {
                      if (soundAvailable) void configureAudio(!quiet);
                      else
                        setNotice(
                          Platform.OS === "ios"
                            ? "This browser cannot suspend media here. Use the player controls."
                            : Platform.OS === "web" ? "Use this website’s own player controls." : "This system WebView does not support site-wide sound control. Use the player or update Android System WebView.",
                        );
                    },
                    soundAvailable ? undefined : "System support unavailable",
                    quiet,
                    quiet ? "muted" : "sound",
                  )}
                  {row(
                    fullscreen ? "Exit fullscreen" : "Fullscreen",
                    () => {
                      if (Platform.OS === "web") {
                        if (fullscreen && globalThis.document.fullscreenElement) void globalThis.document.exitFullscreen().catch(() => {});
                        else if (!fullscreen) void globalThis.document.documentElement.requestFullscreen?.().catch(() => {});
                      }
                      setFullscreen(!fullscreen);
                      setVisible(fullscreen);
                      setPanel(null);
                    },
                    "Tap the grip for controls.",
                    fullscreen,
                    fullscreen ? "exitFullscreen" : "fullscreen",
                  )}
                  {row(
                    "Share",
                    () => {
                      if (Platform.OS === "web" && !globalThis.navigator?.share) {
                        void Clipboard.setStringAsync(url).then(() => setNotice("Page address copied."), () => setNotice("Use Address to copy the page link."));
                        return;
                      }
                      void Share.share({
                        message: url,
                        url,
                        title: current.title,
                      }).catch(() => setNotice("Sharing unavailable."));
                    },
                    undefined,
                    false,
                    "share",
                  )}
                  {row(
                    "Library",
                    () => show("Library"),
                    undefined,
                    false,
                    "library",
                  )}
                  {row(
                    "Discover",
                    () => show("Discover"),
                    suggestion ? "Up next · " + suggestion.title : undefined,
                    false,
                    "discover",
                  )}

                  {row(
                    "Settings",
                    () => show("Settings"),
                    undefined,
                    false,
                    "settings",
                  )}
                  <Pressable
                    accessibilityLabel="RODDY homepage"
                    onPress={() => visit("https://roddy.world/", "RODDY")}
                    style={{ alignSelf: "flex-start", padding: 10 }}
                  >
                    <Image
                      source={require("./assets/roddy.png")}
                      resizeMode="contain"
                      style={{ width: 86, height: 24 }}
                    />
                  </Pressable>
                </>
              )}
              {panel === "Address" && (
                <>
                  <TextInput
                    accessibilityLabel="Full URL"
                    autoFocus
                    selectTextOnFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    style={c.panelInput}
                    value={address}
                    onChangeText={setAddress}
                    onSubmitEditing={go}
                  />
                  {row("Go", go)}
                  {row("Copy current address", () => {
                    void Clipboard.setStringAsync(url)
                      .then(() => setNotice("Address copied."))
                      .catch(() => setNotice("Copy unavailable."));
                  })}
                </>
              )}
              {panel === "Discover" && (
                <>
                  {suggestion && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={"Visit " + suggestion.title}
                      onPress={() => discover()}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 8,
                        gap: 12,
                        backgroundColor: p.dark,
                      }}
                    >
                      <Thumbnail
                        key={suggestion.slug}
                        p={p}
                        uri={thumbnail(suggestion)}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fff5dd", fontSize: 12 }}>
                          UP NEXT
                        </Text>
                        <Text style={c.title}>{suggestion.title}</Text>
                      </View>
                    </Pressable>
                  )}
                  {(["Shuffle", "Play", "Ring"] as Mode[]).map((m, i) =>
                    row(
                      [
                        "Shuffle the neighborhood",
                        "Play the neighborhood",
                        "Follow the ring",
                      ][i],
                      () => discover(m),
                      undefined,
                      m === prefs.mode,
                    ),
                  )}
                  <TextInput
                    accessibilityLabel="Search Grub"
                    placeholder="Search Grub by site, subject or tag"
                    placeholderTextColor="#666"
                    style={c.panelInput}
                    value={query}
                    onChangeText={setQuery}
                  />
                  {row(
                    "Playable only",
                    () => setPlayFilter(!playFilter),
                    undefined,
                    playFilter,
                    "discover",
                  )}
                  {!!catalogState &&
                    row(catalogState, () => setRefresh((n) => n + 1))}
                  {!catalogState && !results.length && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ padding: 12, color: p.ink }}
                    >
                      No listed sites match. Try another subject or turn off the
                      playable filter.
                    </Text>
                  )}
                  {results.map((s) => (
                    <Row
                      key={s.slug}
                      p={p}
                      label={s.title}
                      detail={s.slug + ".yestersites.com"}
                      onPress={() => openMember(s)}
                    />
                  ))}
                  {row("Open Grub", () =>
                    visit(
                      "https://yestersites.com/crawler/?q=" +
                        encodeURIComponent(query),
                      "Grub",
                    ),
                  )}
                </>
              )}
              {panel === "Library" && (
                <>
                  <View style={c.keys}>
                    <Key
                      p={p}
                      label="Bookmarks"
                      onPress={() => setRecentTab(false)}
                    />
                    <Key
                      p={p}
                      label="Travel log"
                      onPress={() => setRecentTab(true)}
                    />
                  </View>
                  {records.length === 0 && (
                    <Text style={{ padding: 16, color: p.ink }}>
                      {recentTab
                        ? "No pages visited yet."
                        : "Your saved pages appear here."}
                    </Text>
                  )}
                  {records.map((r, index) => {
                    const site = sites.find(
                      (s) =>
                        new URL(r.url).hostname === s.slug + ".yestersites.com",
                    );
                    return (
                      <LibraryRecord
                        key={r.url}
                        p={p}
                        index={index}
                        title={r.title}
                        url={r.url}
                        thumbnail={site ? thumbnail(site) : undefined}
                        onPress={() => visit(r.url, r.title, r.member)}
                      />
                    );
                  })}
                </>
              )}
              {panel === "Settings" && (
                <Settings
                  changeStartup={(resume) => lib.setStartup(resume, current)}
                  {...{ lib, p, section, preview, handle }}
                  choose={setPreview}
                  sectionTo={setSection}
                  create={() => create()}
                  account={(path) => create(SERVICE + path)}
                  credit={() => visit("https://roddy.world/", "RODDY")}
                />
              )}
              {(notice || lib.storageError) && (
                <Text style={{ padding: 9, color: p.ink }}>
                  {notice || "Could not save your library on this device."}
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Browser />
    </SafeAreaProvider>
  );
}
