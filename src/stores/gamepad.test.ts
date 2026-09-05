// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { defaultGamepadMapping, pollGamepad, validateGamepad } from "./gamepad";

const pad = (pressed: number[]) => ({
  buttons: Array.from({ length: 16 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: false,
    value: pressed.includes(index) ? 1 : 0,
  })),
  axes: [0, 0],
});
describe("controller input", () => {
  it("uses saved mappings instead of hard-coded default buttons", () => {
    expect(
      pollGamepad(
        pad([0]),
        { ...defaultGamepadMapping, 0: "fullscreen" },
        new Map(),
        0,
      ),
    ).toEqual(["fullscreen"]);
  });
  it("fires confirm once per press and rate-limits held seek", () => {
    const held = new Map();
    expect(pollGamepad(pad([0, 7]), defaultGamepadMapping, held, 0)).toEqual([
      "confirm",
      "forward",
    ]);
    expect(pollGamepad(pad([0, 7]), defaultGamepadMapping, held, 100)).toEqual(
      [],
    );
    expect(pollGamepad(pad([0, 7]), defaultGamepadMapping, held, 350)).toEqual([
      "forward",
    ]);
    pollGamepad(pad([]), defaultGamepadMapping, held, 400);
    expect(pollGamepad(pad([0]), defaultGamepadMapping, held, 410)).toEqual([
      "confirm",
    ]);
  });
  it("validates imported mappings and ignores analogue drift", () => {
    expect(
      validateGamepad({
        enabled: "yes",
        mapping: { 0: "fullscreen", 1: "evil", 999: "next" },
      }),
    ).toMatchObject({
      enabled: false,
      mapping: { 0: "fullscreen", 1: "back" },
    });
    expect(
      pollGamepad(
        { ...pad([]), axes: [0.2, -0.1] },
        defaultGamepadMapping,
        new Map(),
        0,
      ),
    ).toEqual([]);
    expect(
      pollGamepad(
        { ...pad([]), axes: [0, -0.9] },
        defaultGamepadMapping,
        new Map(),
        0,
      ),
    ).toEqual(["up"]);
  });
});
