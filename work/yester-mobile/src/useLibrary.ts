import { useEffect, useRef, useState } from "react";
import Storage from "@react-native-async-storage/async-storage";
import { webURL, type Visit, type Mode } from "./discovery";
import { frames, type Frame } from "./chrome";
type Prefs = {
  frame: Frame;
  autoHide: boolean;
  tapForSound: boolean;
  mode: Mode;
};
type Data = { marks: Visit[]; recent: Visit[]; prefs: Prefs };
const empty: Data = {
  marks: [],
  recent: [],
  prefs: {
    frame: "Switchboard",
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
          marks: visits(v.marks),
          recent: visits(v.recent),
          prefs: {
            frame: Object.prototype.hasOwnProperty.call(frames, p.frame)
              ? p.frame
              : "Switchboard",
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
      update((d) => ({ ...d, prefs: { ...d.prefs, [k]: value } })),
    recent: (v: Visit) =>
      update((d) =>
        d.recent[0]?.url === v.url && d.recent[0]?.title === v.title
          ? d
          : {
              ...d,
              recent: [v, ...d.recent.filter((r) => r.url !== v.url)].slice(
                0,
                150,
              ),
            },
      ),
    bookmark: (v: Visit) =>
      update((d) => ({
        ...d,
        marks: d.marks.some((m) => m.url === v.url)
          ? d.marks.filter((m) => m.url !== v.url)
          : [v, ...d.marks],
      })),
  };
}
