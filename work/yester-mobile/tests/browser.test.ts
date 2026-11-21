import test from "node:test";
import assert from "node:assert/strict";
import { memberOf, nextSite, webURL } from "../src/discovery.ts";
import { Trail } from "../src/trail.ts";
const pool = ["bee", "arcade", "radio"].map((slug) => ({
  slug,
  title: slug,
  playable: slug === "arcade",
  tags: [],
  categories: [],
}));
test("ring navigation keeps the member anchor across an outside page and wraps", () => {
  assert.equal(nextSite(pool, "Ring", "arcade", new Set())?.slug, "bee");
  assert.equal(nextSite(pool, "Ring", "radio", new Set())?.slug, "arcade");
  assert.equal(memberOf("https://arcade.yestersites.com/room?a=1"), "arcade");
  assert.equal(memberOf("https://elsewhere.com/room"), null);
  assert.equal(memberOf("https://android.yestersites.com/"), null);
});
test("shuffle exhausts the pool before cycling and playable mode filters it", () => {
  const seen = new Set(["bee", "radio"]);
  assert.equal(nextSite(pool, "Shuffle", "radio", seen)?.slug, "arcade");
  seen.add("arcade");
  assert.equal(nextSite(pool, "Shuffle", "arcade", seen, () => 0)?.slug, "bee");
  assert.equal(nextSite(pool, "Play", "bee", new Set())?.slug, "arcade");
  assert.equal(nextSite([], "Play", null, new Set()), undefined);
});
test("back and forward preserve interior URLs and a new link branches history", () => {
  const trail = new Trail();
  for (const [url, session] of [
    ["https://arcade.yestersites.com/", 1],
    ["https://arcade.yestersites.com/room?x=1#game", 1],
    ["https://outside.com/", 1],
    ["https://radio.yestersites.com/", 2],
  ] as const)
    trail.push({
      url,
      session,
      title: url,
      member: session === 1 ? "arcade" : "radio",
    });
  assert.equal(trail.move(-1)?.url, "https://outside.com/");
  assert.equal(
    trail.move(-1)?.url,
    "https://arcade.yestersites.com/room?x=1#game",
  );
  assert.equal(trail.move(1)?.member, "arcade");
  trail.push({ ...trail.current, url: "https://outside.com/log" });
  assert.equal(trail.forward, false);
});
test("address entry preserves full links and accepts only web navigation", () => {
  assert.equal(
    webURL("arcade.yestersites.com/room?q=1#game", true),
    "https://arcade.yestersites.com/room?q=1#game",
  );
  for (const input of [
    "file:///tmp/test",
    "javascript:alert(1)",
    "intent://test",
    "https://user:pwd@example.org",
    "not a url",
  ])
    assert.equal(webURL(input, true), null);
});
