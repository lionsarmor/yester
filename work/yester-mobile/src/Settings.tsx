import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Art, frames, Key, Row, type Frame, type Palette } from "./chrome";
import type { FrameAction } from "./frames";
import type { useLibrary, Prefs } from "./useLibrary";
import config from "../app.json";
import { specimens } from "./specimens";
const sections = [
  ["Frame cabinet", "settings"],
  ["Startup and editions", "address"],
  ["Navigation", "discover"],
  ["Sound and media", "sound"],
  ["Library and privacy", "library"],
  ["Accessibility", "settings"],
  ["Creator tools", "creator"],
  ["About YESTER", "account"],
] as const;
type Props = {
  lib: ReturnType<typeof useLibrary>;
  p: Palette;
  preview: Frame | null;
  choose: (f: Frame | null) => void;
  section: string;
  sectionTo: (name: string) => void;
  create: () => void;
  account: (path: string) => void;
  credit: () => void;
  handle: string;
  changeStartup: (resume: boolean) => void;
};
export function Settings({
  lib,
  p,
  preview,
  choose,
  section,
  sectionTo,
  create,
  account,
  credit,
  handle,
  changeStartup,
}: Props) {
  const wide = useWindowDimensions().width >= 700,
    prefs = lib.data.prefs;
  const [feedback, setFeedback] = useState("");
  function select(group: string) {
    choose(null);
    setFeedback("");
    sectionTo(group);
  }
  const groups = (
    <View style={wide ? { width: "34%" } : undefined}>
      {sections.map(([name, icon]) => (
        <Row
          key={name}
          label={name}
          action={icon}
          p={p}
          selected={section === name}
          onPress={() => select(name)}
        />
      ))}
    </View>
  );
  const row = (
    label: string,
    onPress: () => void,
    selected = false,
    detail?: string,
    action?: FrameAction,
  ) => <Row key={label} {...{ label, onPress, selected, detail, action, p }} />;
  const toggle = (
    key: keyof Pick<
      Prefs,
      | "autoHide"
      | "folded"
      | "gestures"
      | "quiet"
      | "tapForSound"
      | "log"
      | "contrast"
    >,
    label: string,
    detail?: string,
  ) => row(label, () => lib.preference(key, !prefs[key]), prefs[key], detail);
  const heading = (s: string) => (
    <Text
      style={{ padding: 10, fontSize: 16, fontWeight: "bold", color: p.ink }}
    >
      {s}
    </Text>
  );
  if (!wide && !section) return groups;
  return (
    <View style={{ flexDirection: wide ? "row" : "column" }}>
      {wide && groups}
      <View style={{ flex: 1, minWidth: 0 }}>
        {!wide &&
          row("All settings", () => select(""), false, undefined, "back")}
        {heading(section || "Choose a settings section")}
        {section === "Frame cabinet" && (
          <>
            <View style={{ padding: 7, overflow: "hidden" }}>
              <Art source={p.housing} />
              <Image
                source={require("../assets/specimen.webp")}
                resizeMode="cover"
                style={{ width: "100%", height: 86 }}
              />
              <View style={{ padding: 5, overflow: "hidden" }}>
                <Art source={p.addressArt} />
                <Text
                  style={{
                    color: p.displayInk,
                    paddingHorizontal: 12,
                    fontFamily: "monospace",
                  }}
                >
                  quarter-moon-arcade.yestersites.com
                </Text>
              </View>
              <View
                accessible
                accessibilityLabel="Sample keys"
                pointerEvents="none"
                style={{ flexDirection: "row", gap: 3 }}
              >
                {["Back", "Next", "Reload", "Tools"].map((label) => (
                  <Key key={label} label={label} p={p} onPress={() => {}} />
                ))}
              </View>
            </View>
            {row(
              "Apply frame",
              () => {
                if (preview) lib.preference("frame", preview);
                choose(null);
                setFeedback("Frame saved on this device.");
              },
              false,
              preview || prefs.frame,
              "save",
            )}
            {preview &&
              row("Cancel preview", () => {
                choose(null);
                setFeedback("");
              })}
            {!!feedback && (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: p.ink, padding: 6 }}
              >
                {feedback}
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(Object.keys(frames) as Frame[]).map((name) => {
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    accessibilityState={{
                      selected: name === (preview || prefs.frame),
                    }}
                    onPress={() => {
                      choose(name);
                      setFeedback("");
                    }}
                    style={{ width: "50%", padding: 4 }}
                  >
                    <Image
                      source={specimens[name]}
                      resizeMode="stretch"
                      accessible={false}
                      style={{
                        width: "100%",
                        aspectRatio: 1.5,
                        borderWidth: 2,
                        borderColor:
                          name === (preview || prefs.frame) ? p.accent : p.edge,
                      }}
                    />
                    <Text style={{ color: p.ink, fontWeight: "bold" }}>
                      {name}
                      {name === prefs.frame ? " ✓" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {section === "Startup and editions" && (
          <>
            {row(
              "Discover a random site",
              () => changeStartup(false),
              !prefs.resume,
            )}
            {row(
              "Resume the last page",
              () => changeStartup(true),
              prefs.resume,
              "Stores your last page on this device.",
            )}
            {heading("New discoveries")}
            {row(
              "Creator’s layout",
              () => lib.preference("textEdition", false),
              !prefs.textEdition,
            )}
            {row(
              "Text edition",
              () => lib.preference("textEdition", true),
              prefs.textEdition,
              "Sites without a text edition open in their original layout.",
            )}
          </>
        )}
        {section === "Navigation" && (
          <>
            {toggle("gestures", "Swipe the grip to discover")}
            {toggle("folded", "Start with the toolbar folded")}
            {toggle("autoHide", "Hide controls after six seconds")}
            {heading("Discovery mode")}
            {(["Shuffle", "Play", "Ring"] as const).map((m) =>
              row(m, () => lib.preference("mode", m), prefs.mode === m),
            )}
          </>
        )}
        {section === "Sound and media" && (
          <>
            {toggle(
              "quiet",
              "Start visits quiet",
              "Android mutes supported WebViews. On iOS this suspends media playback.",
            )}
            {toggle(
              "tapForSound",
              "Require a tap for playback",
              "Websites and devices may still require a tap. Applies to new visits.",
            )}
          </>
        )}
        {section === "Library and privacy" && (
          <>
            {toggle("log", "Record travel history")}
            {row(
              "Clear travel log",
              () =>
                Alert.alert(
                  "Clear travel log?",
                  "Your bookmarks will be kept.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear log",
                      style: "destructive",
                      onPress: lib.clearHistory,
                    },
                  ],
                ),
              false,
              lib.data.recent.length + " recent pages",
              "history",
            )}
            {heading("Saved bookmarks")}
            {lib.data.marks.map((m) =>
              row(
                "Remove " + m.title,
                () =>
                  Alert.alert("Remove bookmark?", m.url, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", onPress: () => lib.bookmark(m) },
                  ]),
                false,
                m.url,
                "saved",
              ),
            )}
          </>
        )}
        {section === "Accessibility" && (
          <>
            {toggle(
              "contrast",
              "High contrast controls",
              "Use plain high-contrast keys and address text with this frame.",
            )}
            {heading(
              "System text size is supported. The dock uses static artwork. Every grip gesture also has a button.",
            )}
          </>
        )}
        {section === "Creator tools" && (
          <>
            {row(
              "Make your own site",
              create,
              false,
              "Open the Retro Page editor",
              "creator",
            )}
            {row(
              "My Sites",
              () => account("/account/"),
              false,
              "Edit and manage published sites",
              "library",
            )}
            {row(
              handle ? "Profile · " + handle : "Sign in",
              () => account(handle ? "/account/profile/" : "/signin/"),
              false,
              "YesterSites email and password",
              "account",
            )}
          </>
        )}
        {section === "About YESTER" && (
          <>
            {heading("YESTER " + config.expo.version)}
            {heading(
              "Swipe up from the grip for another site. Back retraces your pages. Forward becomes Next when you catch up.",
            )}
            {row("A product of RODDY", credit, false, "roddy.world", "account")}
          </>
        )}
      </View>
    </View>
  );
}
