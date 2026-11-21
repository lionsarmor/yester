import assert from "node:assert/strict";
import test from "node:test";
import { turnDecision } from "../src/pageTurn.ts";

const drag = { phase: "move" as const, dx: -90, dy: 6, elapsed: 650, held: false };
test("a short slow peek can reverse or cancel without navigating", () => {
  assert.equal(turnDecision(drag, 400).commit, false);
  assert.equal(turnDecision({...drag, phase:"end", dx:-35}, 400).commit, false);
  assert.equal(turnDecision({...drag, dx:60}, 400).direction, -1);
  assert.equal(turnDecision({...drag, phase:"cancel", dx:250, held:true}, 400).commit, false);
});
test("a decisive flick opens on release and a held drag opens at the notch", () => {
  assert.equal(turnDecision({...drag, dx:-55, elapsed:68, phase:"end"}, 400).commit, true);
  assert.equal(turnDecision({...drag, dx:154, held:true}, 400).commit, true);
  assert.equal(turnDecision({...drag, dx:-150, held:true}, 400).commit, false);
  assert.equal(turnDecision({...drag, dx:-180, phase:"end"}, 400).commit, true);
  assert.equal(turnDecision({...drag, dx:-66, dy:80, elapsed:65, phase:"end"}, 400).commit, false);
});

import { runInNewContext } from "node:vm";
import { pageTouches } from "../src/pageTurn.ts";

test("the page bridge yields to controls, vertical scroll and a second finger", () => {
  const listeners = new Map<string, (event: object) => void>();
  const turns: string[] = [];
  let time = 0;
  runInNewContext(pageTouches, {
    performance: { now: () => time },
    window: { __yesterTurnsOn: true, getSelection: () => "",
      ReactNativeWebView: { postMessage: (message: string) => turns.push(JSON.parse(message).turn.phase) } },
    document: { addEventListener: (key: string, listener: (event: object) => void) => listeners.set(key, listener) },
    getComputedStyle: () => ({touchAction:"auto", overflowX:"visible"}),
  });
  function touch(type: string, x: number, y: number, control = false, count = 1) {
    const finger = {screenX:x, screenY:y};
    listeners.get(type)!({isTrusted:true, target:{closest:() => control},
      touches:Array(count).fill(finger), changedTouches:[finger], cancelable:true, preventDefault() {}});
    time += 16;
  }
  touch("touchstart",200,100,true);
  touch("touchmove",100,100);
  assert.deepEqual(turns, []);
  touch("touchstart",200,100);
  touch("touchmove",195,150);
  touch("touchend",120,200);
  assert.deepEqual(turns, ["start"]);
  touch("touchstart",200,100);
  touch("touchmove",160,100);
  touch("touchstart",160,100,false,2);
  touch("touchend",5,100);
  assert.deepEqual(turns, ["start","start","move","cancel"]);
});
