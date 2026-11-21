import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
export const frames = {
  Switchboard: {
    surface: "#e5e0ce",
    light: "#fffef1",
    edge: "#766f60",
    dark: "#24493f",
    ink: "#20251f",
    paper: "#fffdf1",
  },
  "After Hours": {
    surface: "#393541",
    light: "#696274",
    edge: "#17151b",
    dark: "#4f3853",
    ink: "#fff0d6",
    paper: "#25222b",
  },
} as const;
export type Frame = keyof typeof frames;
export type Palette = (typeof frames)[Frame];
const icons: Record<string, number> = {
  Back: require("../assets/back.png"),
  Forward: require("../assets/next.png"),
  Next: require("../assets/next.png"),
  Browse: require("../assets/next.png"),
  Stop: require("../assets/stop.png"),
  Reload: require("../assets/reload.png"),
  Menu: require("../assets/menu.png"),
};
export function Key({
  label,
  glyph,
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        c.key,
        {
          backgroundColor: p.surface,
          borderTopColor: pressed ? p.edge : p.light,
          borderLeftColor: pressed ? p.edge : p.light,
          borderRightColor: p.edge,
          borderBottomColor: p.edge,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {icons[label] ? (
        <Image
          source={icons[label]}
          resizeMode="contain"
          style={{ width: 22, height: 22 }}
        />
      ) : (
        glyph && (
          <Text allowFontScaling={false} style={[c.glyph, { color: p.ink }]}>
            {glyph}
          </Text>
        )
      )}
      <Text style={[c.keyLabel, { color: p.ink }]}>{label}</Text>
    </Pressable>
  );
}
export function Row({
  label,
  detail,
  onPress,
  p,
  selected = false,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  p: Palette;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        c.row,
        {
          backgroundColor: pressed ? p.surface : p.paper,
          borderBottomColor: p.edge,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[c.rowLabel, { color: p.ink }]}>{label}</Text>
        {!!detail && (
          <Text numberOfLines={2} style={{ color: p.ink, fontSize: 13 }}>
            {detail}
          </Text>
        )}
      </View>
      <Text style={{ color: p.ink, fontSize: 18 }}>{selected ? "✓" : "›"}</Text>
    </Pressable>
  );
}
export const c = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 5, paddingBottom: 4, gap: 3 },
  address: {
    minHeight: 36,
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
    minHeight: 44,
    minWidth: 48,
    flex: 1,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  glyph: { fontSize: 17, fontWeight: "bold", lineHeight: 20 },
  keyLabel: { fontWeight: "700", fontSize: 12 },
  grip: { height: 26, justifyContent: "center", alignItems: "center" },
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
    minHeight: 47,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16, fontWeight: "600" },
  panelInput: {
    minHeight: 44,
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
