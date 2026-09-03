import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DEFAULT_KEYBOARD_SHORTCUTS } from "@/utils/keyboardShortcuts";

import { KeyboardCommandsEditModal } from "./KeyboardCommandsEditModal";

const hideModal = vi.fn();
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
  useModal: () => ({ isShown: true }),
}));
vi.mock("@/stores/interface/overlayStack", () => ({
  useOverlayStack: () => ({ hideModal }),
}));
vi.mock("@/stores/preferences", () => ({
  usePreferencesStore: (selector: (value: typeof preferences) => unknown) =>
    selector(preferences),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
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
