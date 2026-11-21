import { useEffect, useRef, useState } from "react";
import Storage from "@react-native-async-storage/async-storage";
import { webURL, type Visit, type Mode } from "./discovery";
import { frames, type Frame } from "./chrome";
export type Prefs = {
  frame: Frame;
  resume: boolean;
  textEdition: boolean;
  gestures: boolean;
  folded: boolean;
  quiet: boolean;
  log: boolean;
  contrast: boolean;
  autoHide: boolean;
  tapForSound: boolean;
  mode: Mode;
};
type Data = {
  marks: Visit[];
  recent: Visit[];
  prefs: Prefs;
  last: Visit | null;
};
const empty: Data = {
  last: null,
  marks: [],
  recent: [],
  prefs: {
    frame: "DeskSet 3.2",
    resume: false,
    textEdition: false,
    gestures: true,
    folded: false,
    quiet: false,
    log: true,
    contrast: false,
    autoHide: true,
    tapForSound: true,
    mode: "Shuffle",
  },
};
const key = "world.roddy.yester.library.v1";
function visits(v: unknown): Visit[] {
  return Array.isArray(v)
    ? v
        .filter(
          (r) =>
            r &&
            typeof r.url === "string" &&
            webURL(r.url) &&
            typeof r.title === "string",
        )
        .map((r) => ({
          ...r,
          member: typeof r.member === "string" ? r.member : null,
        }))
    : [];
}
export function useLibrary() {
  const [data, update] = useState<Data>(empty),
    [ready, setReady] = useState(false),
    [storageError, setError] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let live = true;
    Storage.getItem(key)
      .then((text) => {
        if (!live || !text) return;
        const v = JSON.parse(text),
          p = v.prefs || {};
        update({
          last: visits([v.last])[0] || null,
          marks: visits(v.marks),
          recent: visits(v.recent),
          prefs: {
            frame: Object.prototype.hasOwnProperty.call(frames, p.frame)
              ? p.frame
              : "DeskSet 3.2",
            resume: p.resume === true,
            textEdition: p.textEdition === true,
            gestures: p.gestures !== false,
            folded: p.folded === true,
            quiet: p.quiet === true,
            log: p.log !== false,
            contrast: p.contrast === true,
            autoHide: p.autoHide !== false,
            tapForSound: p.tapForSound !== false,
            mode: ["Shuffle", "Play", "Ring"].includes(p.mode)
              ? p.mode
              : "Shuffle",
          },
        });
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready)
      writes.current = writes.current
        .then(() => Storage.setItem(key, JSON.stringify(data)))
        .then(() => setError(false))
        .catch(() => setError(true));
  }, [ready, data]);
  return {
    data,
    ready,
    storageError,
    preference: <K extends keyof Prefs>(k: K, value: Prefs[K]) =>
      update((d) => ({
        ...d,
        last: k === "resume" && !value ? null : d.last,
        prefs: { ...d.prefs, [k]: value },
      })),
    clearHistory: () => update((d) => ({ ...d, recent: [], last: null })),
    recent: (v: Visit) =>
      update((d) => {
        const last = d.prefs.resume ? v : null;
        if (!d.prefs.log) return last === d.last ? d : { ...d, last };
        return {
          ...d,
          last,
          recent: [v, ...d.recent.filter((r) => r.url !== v.url)].slice(0, 150),
        };
      }),
    bookmark: (v: Visit) =>
      update((d) => ({
        ...d,
        marks: d.marks.some((m) => m.url === v.url)
          ? d.marks.filter((m) => m.url !== v.url)
          : [v, ...d.marks],
      })),
  };
}
