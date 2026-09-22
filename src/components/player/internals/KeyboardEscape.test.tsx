// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { useGlobalKeyboardEvents } from "@/hooks/useGlobalKeyboardEvents";
import { useOverlayStack } from "@/stores/interface/overlayStack";
import { usePlayerStore } from "@/stores/player/store";

import { KeyboardEvents } from "./KeyboardEvents";

const close = vi.fn();
vi.mock("@/hooks/useOverlayRouter", () => ({
  useOverlayRouter: () => ({ close, isRouterActive: true }),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
function GlobalEvents() {
  useGlobalKeyboardEvents();
  return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  close.mockClear();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useOverlayStack.getState().clearAllModals();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <>
        <GlobalEvents />
        <KeyboardEvents />
        <input type="range" aria-label="Brightness" />
        <input type="text" aria-label="Search" />
        <textarea aria-label="Text" />
      </>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useOverlayStack.getState().clearAllModals();
  vi.unstubAllGlobals();
});
function press(target: Element, key = "Escape") {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

it("closes the player menu when Escape originates in a focused range or text input", () => {
  for (const input of container.querySelectorAll("input")) {
    input.focus();
    expect(press(input).defaultPrevented).toBe(true);
  }
  expect(close).toHaveBeenCalledTimes(2);
});

it("closes only the top stacked modal before allowing a later Escape to close the player menu", () => {
  act(() => {
    useOverlayStack.getState().showModal("first");
    useOverlayStack.getState().showModal("second");
  });
  const input = container.querySelector("input")!;
  press(input);
  expect(useOverlayStack.getState().modalStack).toEqual(["first"]);
  expect(close).not.toHaveBeenCalled();
  press(input);
  expect(useOverlayStack.getState().modalStack).toEqual([]);
  expect(close).not.toHaveBeenCalled();
  press(input);
  expect(close).toHaveBeenCalledOnce();
});

it("leaves focused details dialogs and already-consumed Escape events in control", () => {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("data-details-modal-layer", "");
  const field = document.createElement("input");
  dialog.append(field);
  container.append(dialog);
  act(() => useOverlayStack.getState().showModal("behind-details"));
  expect(press(field).defaultPrevented).toBe(false);
  expect(useOverlayStack.getState().getTopModal()).toBe("behind-details");
  expect(close).not.toHaveBeenCalled();
  dialog.remove();
  act(() => useOverlayStack.getState().clearAllModals());
  const input = container.querySelector("input")!;
  input.addEventListener("keydown", (event) => event.preventDefault());
  press(input);
  expect(close).not.toHaveBeenCalled();
});

it("does not interpret text entry as playback shortcuts", () => {
  const play = vi.fn();
  const pause = vi.fn();
  const setTime = vi.fn();
  act(() =>
    usePlayerStore.setState((state) => {
      state.display = { play, pause, setTime } as unknown as DisplayInterface;
      state.progress.duration = 1000;
    }),
  );
  for (const field of container.querySelectorAll(
    'input[type="text"], textarea',
  )) {
    expect(press(field, "k").defaultPrevented).toBe(false);
    expect(press(field, "1").defaultPrevented).toBe(false);
  }
  expect(play).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  expect(setTime).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
