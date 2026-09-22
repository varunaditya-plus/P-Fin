// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectableLink } from "@/components/player/internals/ContextMenu/Links";

import { AudioBoostControls } from "./AudioBoostSettingsView";
import { PlaybackSlider } from "./PlaybackSlider";
import { PlaybackSpeedControl } from "./PlaybackSpeedControl";
import { usePlaybackEnhancements } from "./preferences";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function input(value: string) {
  const element = container.querySelector(
    'input[type="number"]',
  )! as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return element;
}
function key(element: HTMLElement, value: string) {
  act(() =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true }),
    ),
  );
}

describe("player setting interactions", () => {
  it("does not invoke disabled selectable actions", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <SelectableLink disabled onClick={change}>
          Busy track
        </SelectableLink>,
      ),
    );
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(change).not.toHaveBeenCalled();
  });
  it("accepts custom speeds, rejects invalid values, and allows cancellation", () => {
    const change = vi.fn();
    act(() =>
      root.render(<PlaybackSpeedControl value={1} onChange={change} />),
    );
    const button = container.querySelector('[aria-label="1x playback speed"]')!;
    act(() =>
      button.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    key(input("8"), "Enter");
    expect(change).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "0.1 to 5",
    );
    key(input("1.35"), "Enter");
    expect(change).toHaveBeenLastCalledWith(1.35);
    act(() =>
      button.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    // Re-rendered buttons are selected again after finishing the edit.
    const current = container.querySelector('[aria-label="1x playback speed"]');
    if (current)
      act(() =>
        current.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
      );
    key(input("2.5"), "Escape");
    expect(change).toHaveBeenCalledTimes(1);
  });
  it("clamps direct boost values and discards an escaped edit", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <PlaybackSlider
          label="Boost level"
          value={100}
          min={100}
          max={600}
          step={1}
          defaultValue={100}
          onChange={change}
          onReset={() => change(100)}
          allowDirectInput
        />,
      ),
    );
    const edit = () =>
      act(() =>
        (
          container.querySelector(
            '[aria-label="Edit boost level"]',
          )! as HTMLButtonElement
        ).click(),
      );
    edit();
    key(input("900"), "Enter");
    expect(change).toHaveBeenLastCalledWith(600);
    edit();
    key(input("250"), "Escape");
    expect(change).toHaveBeenCalledTimes(1);
  });
});

it("updates the named boost switch when playback changes to a title with different remembered boost", () => {
  usePlaybackEnhancements.setState({
    activeItem: "first",
    activeTitle: "first",
    boost: 100,
    boostByTitle: { second: 240 },
    rememberBoost: false,
  });
  act(() => root.render(<AudioBoostControls />));
  const toggle = () =>
    container.querySelector<HTMLButtonElement>(
      '[role="switch"][aria-label="Volume boost"]',
    )!;
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  act(() =>
    usePlaybackEnhancements.getState().bindPlayback("second", "second"),
  );
  expect(toggle().getAttribute("aria-checked")).toBe("true");
  expect(
    container.querySelector<HTMLInputElement>('input[type="range"]')?.value,
  ).toBe("240");
  act(() => usePlaybackEnhancements.getState().bindPlayback("third", "third"));
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(container.querySelector('input[type="range"]')).toBeNull();
  act(() => toggle().click());
  expect(toggle().getAttribute("aria-checked")).toBe("true");
});
