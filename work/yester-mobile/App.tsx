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
import WebView, { type WebViewNavigation } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { c, frames, Key, Row, type Frame } from "./src/chrome";
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
  const prefs = lib.data.prefs,
    p = frames[prefs.frame];
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
  const editorSource = React.useMemo(() => ({ uri: EDITOR }), []);
  function wake() {
    setVisible(true);
    setActivity((n) => n + 1);
  }
  function show(which: Panel) {
    wake();
    setNotice("");
    setPanel(which);
  }
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsReading);
    const sub = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsReading,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (held) return;
    if (isReading || !prefs.autoHide || panel || editor) {
      setVisible(true);
      return;
    }
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
  function mountPage(entry: Entry) {
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
    visit(homepage(site), site.title, site.slug);
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
    if (panel) {
      setPanel(null);
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
    const sub = BackHandler.addEventListener("hardwareBackPress", back);
    return () => sub.remove();
  });
  function create() {
    generation.current++;
    setDocument({ key: generation.current, url: EDITOR });
    setEditor(true);
    setUrl(EDITOR);
    setNative({ back: false, forward: false });
    setBusy(true);
    setError("");
    setPanel(null);
    wake();
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
  ) => (
    <Row
      key={label}
      p={p}
      label={label}
      detail={detail}
      selected={selected}
      onPress={action}
    />
  );
  const records = recentTab ? lib.data.recent : lib.data.marks;
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
        <WebView<object>
          key={document.key}
          ref={view}
          source={editor ? editorSource : source}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={prefs.tapForSound}
          allowFileAccess={false}
          mixedContentMode="never"
          originWhitelist={["*"]}
          injectedJavaScript={editor ? editorForms : undefined}
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
              setError("");
            }
          }}
          onLoadEnd={() => {
            if (document.key === generation.current) setBusy(false);
          }}
          onError={(e) => {
            if (document.key === generation.current)
              setError(e.nativeEvent.description || "Connection failed");
          }}
        />
        {!!error && (
          <View
            style={[
              c.backdrop,
              {
                justifyContent: "center",
                backgroundColor: p.paper,
                padding: 22,
              },
            ]}
          >
            <Text style={{ color: p.ink, fontSize: 20 }}>Page unavailable</Text>
            <Text style={{ color: p.ink, marginVertical: 12 }}>{error}</Text>
            {row("Try again", () => {
              setError("");
              view.current?.reload();
            })}
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
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Browser grip. Show controls or swipe up for next site"
          onAccessibilityTap={() => {
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
              if (!editor) discover();
            } else {
              setVisible(!visible);
              setActivity((n) => n + 1);
            }
          }}
          onResponderTerminate={() => setHeld(false)}
        >
          <View
            style={[
              c.ridge,
              { borderTopColor: p.edge, borderBottomColor: p.light },
            ]}
          />
        </View>
        {visible && (
          <>
            <View style={c.strip}>
              <View style={[c.brandBox, { backgroundColor: p.dark }]}>
                <Text style={c.brand}>{editor ? "CREATE" : "YESTER"}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Address"
                style={c.address}
                onPress={typeAddress}
              >
                <Text numberOfLines={1} style={c.addrText}>
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
                  } else view.current?.reload();
                  wake();
                }}
              />
              <Key p={p} label="Menu" glyph="☰" onPress={() => show("Menu")} />
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
              <Text style={c.title}>
                {panel === "Menu" ? "YESTER by RODDY" : panel}
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
                    saved ? "Remove bookmark" : "Save page",
                    () => {
                      lib.bookmark(current);
                      show("Library");
                      setRecentTab(false);
                    },
                    current.title,
                  )}
                  {row("Share", () => {
                    void Share.share({
                      message: url,
                      url,
                      title: current.title,
                    }).catch(() => setNotice("Sharing unavailable."));
                  })}
                  {row("Library", () => show("Library"))}
                  {row(
                    "Discover",
                    () => show("Discover"),
                    suggestion ? "Up next · " + suggestion.title : undefined,
                  )}
                  {row("Create", create, "Open Retro Page")}
                  {row("Settings", () => show("Settings"))}
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
                      <Image
                        source={{ uri: thumbnail(suggestion) }}
                        resizeMode="contain"
                        style={{ width: 54, height: 44 }}
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
                  {!!catalogState &&
                    row(catalogState, () => setRefresh((n) => n + 1))}
                  {sites
                    .filter((s) =>
                      [s.title, s.slug, ...s.categories, ...s.tags]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
                    )
                    .map((s) => (
                      <Row
                        key={s.slug}
                        p={p}
                        label={s.title}
                        detail={s.slug + ".yestersites.com"}
                        onPress={() => visit(homepage(s), s.title, s.slug)}
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
                      label="Recent"
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
                  {records.map((r) => (
                    <Row
                      key={r.url}
                      p={p}
                      label={r.title}
                      detail={r.url}
                      onPress={() => visit(r.url, r.title, r.member)}
                    />
                  ))}
                </>
              )}
              {panel === "Settings" && (
                <>
                  {(Object.keys(frames) as Frame[]).map((f) =>
                    row(
                      f,
                      () => lib.preference("frame", f),
                      "Browser frame",
                      prefs.frame === f,
                    ),
                  )}
                  {row(
                    "Hide controls after six seconds",
                    () => lib.preference("autoHide", !prefs.autoHide),
                    undefined,
                    prefs.autoHide,
                  )}
                  {row(
                    "Tap to start sound",
                    () => lib.preference("tapForSound", !prefs.tapForSound),
                    "Websites may still require a tap.",
                    prefs.tapForSound,
                  )}
                </>
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
