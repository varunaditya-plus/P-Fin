import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DEFAULT_KEYBOARD_SHORTCUTS } from "@/utils/keyboardShortcuts";

import { KeyboardCommandsEditModal } from "./KeyboardCommandsEditModal";

const hideModal = vi.fn();
let shown = true;
const preferences = {
  keyboardShortcuts: {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    mute: { key: "Q" },
  },
  setKeyboardShortcuts: vi.fn(),
  enableNumberKeySeeking: true,
  setEnableNumberKeySeeking: vi.fn(),
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./Modal", () => ({
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useModal: () => ({ isShown: shown, hide: hideModal }),
}));
vi.mock("@/stores/interface/overlayStack", () => ({
  useOverlayStack: () => ({ hideModal }),
}));
vi.mock("@/stores/preferences", () => ({
  usePreferencesStore: (selector?: (value: typeof preferences) => unknown) =>
    selector ? selector(preferences) : preferences,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  shown = true;
  preferences.keyboardShortcuts = {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    mute: { key: "Q" },
  };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <KeyboardCommandsEditModal id="keyboard-edit" />
      </MemoryRouter>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("saves keyboard preferences locally without an account backend", () => {
  const numberSeeking = [...container.querySelectorAll("p")].find(
    (element) =>
      element.textContent === "global.keyboardShortcuts.numberKeySeeking",
  );
  const toggle =
    numberSeeking?.parentElement?.parentElement?.querySelector("button");
  expect(toggle).toBeDefined();
  act(() => toggle!.click());
  const save = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "global.keyboardShortcuts.saveChanges",
  );
  expect(save).toBeDefined();
  act(() => save!.click());

  expect(preferences.setKeyboardShortcuts).toHaveBeenCalledWith(
    preferences.keyboardShortcuts,
  );
  expect(preferences.setEnableNumberKeySeeking).toHaveBeenCalledWith(false);
  expect(hideModal).toHaveBeenCalledWith("keyboard-edit");
  expect(fetch).not.toHaveBeenCalled();
});

it("discards cancelled drafts and reads current shortcuts when reopened", () => {
  const reset = [...container.querySelectorAll("button")].find(
    (button) =>
      button.textContent === "global.keyboardShortcuts.resetAllToDefault",
  )!;
  act(() => reset.click());
  expect(
    container.querySelector(
      '[aria-label="Edit global.keyboardShortcuts.shortcuts.mute"]',
    )?.textContent,
  ).toBe("M");
  const cancel = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "global.keyboardShortcuts.cancel",
  )!;
  act(() => cancel.click());
  expect(preferences.setKeyboardShortcuts).not.toHaveBeenCalled();
  const render = () =>
    root.render(
      <MemoryRouter>
        <KeyboardCommandsEditModal id="keyboard-edit" />
      </MemoryRouter>,
    );
  shown = false;
  act(render);
  preferences.keyboardShortcuts = {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    mute: { key: "V" },
  };
  shown = true;
  act(render);
  expect(
    container.querySelector(
      '[aria-label="Edit global.keyboardShortcuts.shortcuts.mute"]',
    )?.textContent,
  ).toBe("V");
});
