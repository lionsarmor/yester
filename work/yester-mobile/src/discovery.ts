export const SERVICE = "https://yestersites-webring.jamesmweeksjr.chatgpt.site";
export const EDITOR = "https://retropage.yestersites.com/";
export type Mode = "Shuffle" | "Play" | "Ring";
export type Site = {
  slug: string;
  title: string;
  tags: string[];
  categories: string[];
  playable: boolean;
};
export type Visit = { url: string; title: string; member: string | null };

export function webURL(input: string, addressField = false): string | null {
  const value = input.trim();
  if (!value || /[\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(
      addressField && !/^[a-z][a-z\d+.-]*:/i.test(value)
        ? "https://" + value
        : value,
    );
    return ["http:", "https:"].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function memberOf(url: string): string | null {
  const u = new URL(url);
  if (u.origin === SERVICE)
    return u.pathname.match(/^\/members\/([a-z0-9-]+)(?:\/|$)/)?.[1] ?? null;
  const slug = /^([a-z0-9-]+)\.yestersites\.com$/.exec(u.hostname)?.[1];
  return slug &&
    !["retropage", "www", "api", "assets", "accounts", "studio"].includes(slug)
    ? slug
    : null;
}
export const homepage = (site: Site) =>
  "https://" + site.slug + ".yestersites.com/";
export function nextSite(
  pool: Site[],
  mode: Mode,
  anchor: string | null,
  visited: Set<string>,
  random = Math.random,
): Site | undefined {
  if (!pool.length) return;
  if (mode === "Ring") {
    const ordered = [...pool].sort((a, b) =>
      a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
    );
    return ordered.find((s) => s.slug > (anchor ?? "")) ?? ordered[0];
  }
  const eligible = mode === "Play" ? pool.filter((s) => s.playable) : pool;
  if (!eligible.length) return;
  let fresh = eligible.filter((s) => !visited.has(s.slug) && s.slug !== anchor);
  if (!fresh.length) {
    visited.clear();
    fresh = eligible.filter((s) => s.slug !== anchor);
  }
  const options = fresh.length ? fresh : eligible;
  return options[Math.floor(random() * options.length)];
}
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
export async function directory(playOnly = false): Promise<Site[]> {
  const rows = new Map<string, Site>(),
    seen = new Set<string>();
  let cursor = "";
  do {
    if (seen.has(cursor)) throw Error("Grub returned a repeated page.");
    seen.add(cursor);
    const u = new URL("/api/directory", SERVICE);
    if (playOnly) u.searchParams.set("cap", "playable");
    if (cursor) u.searchParams.set("cursor", cursor);
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(u.href, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw Error("Grub is unavailable.");
        data = await res.json();
        if (!Array.isArray(data.sites)) throw Error("Invalid directory.");
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    for (const s of data.sites) {
      if (
        !s ||
        typeof s.slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug) ||
        s.listed === false
      )
        continue;
      rows.set(s.slug, {
        slug: s.slug,
        title: String(s.title || s.slug),
        categories: strings(s.categories),
        tags: strings(s.tags),
        playable: strings(s.capabilities).includes("playable"),
      });
    }
    cursor = typeof data.nextCursor === "string" ? data.nextCursor : "";
  } while (cursor);
  return [...rows.values()];
}
