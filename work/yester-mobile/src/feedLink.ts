import { memberOf, webURL } from "./discovery.ts";

export const viewerHome = "https://yestersites.com/browse/";
export function memberAddress(raw: string | null) {
  const href = raw && webURL(raw);
  if (!href) return null;
  const u = new URL(href);
  return u.protocol === "https:" && !u.port && memberOf(href) ? href : null;
}
export function feedLink(raw?: string | null) {
  const viewer = new URL(viewerHome);
  const href = memberAddress(raw ?? null);
  if (href) viewer.searchParams.set("url", href);
  return viewer.href;
}
export function openSharedFeed(raw: string | null) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!(u.protocol === "yester:" && u.host === "browse") &&
        !(u.origin === "https://yestersites.com" && u.pathname === "/browse/")) return null;
    const page = memberAddress(u.searchParams.get("url"));
    return page ? feedLink(page) : null;
  } catch { return null; }
}
