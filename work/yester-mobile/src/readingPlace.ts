import bundled from "./readingPlaceScript.json";

export type ReadingPlace = { y: number; path?: number[]; top?: number };
export function readingPlace(value: unknown): ReadingPlace | undefined {
  if (!value || typeof value !== "object" || !("y" in value) ||
      typeof value.y !== "number" || !Number.isFinite(value.y) || value.y < 0) return;
  if ("path" in value && Array.isArray(value.path) && value.path.length <= 24 &&
      value.path.every(i => Number.isInteger(i) && i >= 0) &&
      "top" in value && typeof value.top === "number" && Number.isFinite(value.top))
    return {y:value.y, path:value.path, top:value.top};
  return {y:value.y};
}

export function nativeReadingScript(url: string, place?: ReadingPlace) {
  return `(function(){
    if(window.__yesterRestorePlace) return;
    ${bundled.script}
    window.__yesterRestorePlace = yesterReadingPlace(place => window.ReactNativeWebView.postMessage(JSON.stringify({place})));
    if(location.href===${JSON.stringify(url)})window.__yesterRestorePlace(${JSON.stringify(place || null)});
  })();`;
}
