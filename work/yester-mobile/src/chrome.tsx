import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { frames, type Frame, type Palette, type FrameAction } from "./frames";
export { frames, type Frame, type Palette };
export function Art({
  source,
  stretch = true,
}: {
  source: number;
  stretch?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      <Image
        accessible={false}
        source={source}
        resizeMode={stretch ? "stretch" : "cover"}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
const keyActions: Record<string, FrameAction> = {
  Back: "back",
  Forward: "forward",
  Next: "next",
  Browse: "discover",
  Stop: "stop",
  Reload: "reload",
  Tools: "tools",
};
export function Key({
  label,
  onPress,
  disabled = false,
  p,
}: {
  label: string;
  glyph?: string;
  onPress: () => void;
  disabled?: boolean;
  p: Palette;
}) {
  const [focus, setFocus] = useState(false),
    action = keyActions[label];
  const slot =
    label === "Back"
      ? 0
      : ["Forward", "Next", "Browse"].includes(label)
        ? 1
        : ["Reload", "Stop"].includes(label)
          ? 2
          : 3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={({ pressed }) => [
        c.key,
        {
          overflow: "hidden",
          backgroundColor: p.surface,
          borderRadius: p.radius,
          borderColor: focus ? p.accent : p.edge,
          opacity: disabled ? 0.5 : 1,
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      {({ pressed }) => (
        <>
          {!("contrast" in p) && <Art source={p.keyFaces[slot]} />}
          {action && (
            <Image
              source={p.icons[action]}
              resizeMode="contain"
              style={{ width: 23, height: 23 }}
            />
          )}
          <Text
            numberOfLines={2}
            style={{
              fontWeight: "bold",
              fontSize: 13,
              color: p.keyInks[slot],
              textAlign: "center",
            }}
          >
            {label}
          </Text>
          {pressed && (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#0002" }]}
            />
          )}
        </>
      )}
    </Pressable>
  );
}
export function Row({
  label,
  detail,
  onPress,
  p,
  selected = false,
  action,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  p: Palette;
  selected?: boolean;
  action?: FrameAction;
}) {
  const [focused, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      accessibilityRole="button"
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onPress={onPress}
      style={({ pressed }) => [
        c.row,
        {
          backgroundColor: pressed || focused ? p.surface : p.paper,
          borderBottomColor: p.edge,
        },
      ]}
    >
      {action && (
        <Image
          source={
            action === "creator"
              ? require("../assets/pencil.png")
              : p.icons[action]
          }
          resizeMode="contain"
          style={{ width: 28, height: 28 }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[c.rowLabel, { color: p.ink }]}>{label}</Text>
        {!!detail && (
          <Text style={{ fontSize: 13, color: p.ink }}>{detail}</Text>
        )}
      </View>
      <Text style={{ color: p.ink }}>{selected ? "✓" : "›"}</Text>
    </Pressable>
  );
}
export function Thumbnail({ uri, p }: { uri?: string; p: Palette }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: 56,
        height: 43,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: p.edge,
        backgroundColor: p.dark,
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          style={{ width: 48, height: 35 }}
        />
      ) : (
        <Image
          accessible
          accessibilityLabel="No thumbnail"
          source={p.icons.library}
          resizeMode="contain"
          style={{ width: 24, height: 22 }}
        />
      )}
    </View>
  );
}
export function LibraryRecord({
  p,
  index,
  title,
  url,
  thumbnail,
  onPress,
}: {
  p: Palette;
  index: number;
  title: string;
  url: string;
  thumbnail?: string;
  onPress: () => void;
}) {
  const film = p.name === "Contact Sheet",
    card = p.name === "Card Catalog",
    paper = p.name === "Dot Martix";
  if (!film && !card && !paper)
    return <Row p={p} label={title} detail={url} onPress={onPress} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={url}
      onPress={onPress}
      style={({ pressed }) => [
        c.row,
        {
          marginHorizontal: card ? 7 : 0,
          marginVertical: card ? 4 : 0,
          borderWidth: card ? 1 : 0,
          borderColor: p.edge,
          backgroundColor: pressed
            ? p.surface
            : paper && index % 2 === 0
              ? "#dfebc9"
              : p.paper,
        },
      ]}
    >
      {film && <Thumbnail p={p} uri={thumbnail} />}
      {paper && <Text style={{ color: p.edge }}>○</Text>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.ink, fontWeight: "bold" }}>{title}</Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: "monospace", color: p.ink, fontSize: 13 }}
        >
          {new URL(url).host}
        </Text>
      </View>
    </Pressable>
  );
}
export const c = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 5, paddingBottom: 4, gap: 3 },
  address: {
    minHeight: 48,
    backgroundColor: "#fffdf4",
    borderWidth: 1,
    borderColor: "#6e6b62",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  addrText: { fontFamily: "monospace", fontSize: 14, color: "#20251f" },
  strip: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: {
    color: "#fff5dd",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.2,
  },
  brandBox: { paddingHorizontal: 7, paddingVertical: 6 },
  keys: { flexDirection: "row", gap: 4 },
  key: {
    minHeight: 48,
    minWidth: 48,
    flex: 1,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  glyph: { fontSize: 17, fontWeight: "bold", lineHeight: 20 },
  keyLabel: { fontWeight: "700", fontSize: 12 },
  grip: { height: 48, justifyContent: "center", alignItems: "center" },
  ridge: { height: 5, width: 74, borderTopWidth: 2, borderBottomWidth: 1 },
  backdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#11181488",
    justifyContent: "flex-end",
  },
  sheet: { maxHeight: "88%", borderWidth: 2, padding: 5 },
  head: {
    minHeight: 37,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#fff5dd", fontSize: 17, fontWeight: "800" },
  row: {
    minHeight: 48,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16, fontWeight: "600" },
  panelInput: {
    minHeight: 48,
    backgroundColor: "#fffdf2",
    color: "#20251f",
    borderWidth: 1,
    borderColor: "#605c53",
    paddingHorizontal: 8,
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
});
