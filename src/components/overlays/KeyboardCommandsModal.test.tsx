import { ReactNode, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DEFAULT_KEYBOARD_SHORTCUTS } from "@/utils/keyboardShortcuts";

import { KeyboardCommandsModal } from "./KeyboardCommandsModal";

const hideModal = vi.fn();
const preferences = {
  keyboardShortcuts: {
    ...DEFAULT_KEYBOARD_SHORTCUTS,
    mute: { key: undefined },
  },
  enableNumberKeySeeking: false,
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./KeyboardCommandsFrame", () => ({
  KeyboardCommandsFrame: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/stores/preferences", () => ({
  usePreferencesStore: (selector: (state: typeof preferences) => unknown) =>
    selector(preferences),
}));
vi.mock("@/stores/interface/overlayStack", () => ({
  useOverlayStack: (
    selector: (state: { hideModal: typeof hideModal }) => unknown,
  ) => selector({ hideModal }),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Location() {
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  );
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <KeyboardCommandsModal id="keyboard-guide" />
        <Location />
      </MemoryRouter>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("omits cleared bindings and disabled number seeking from the guide", () => {
  expect(host.textContent).not.toContain(
    "global.keyboardShortcuts.shortcuts.mute",
  );
  expect(host.textContent).not.toContain(
    "global.keyboardShortcuts.groups.jumpToPosition",
  );
});
it("closes the guide before opening the settings preferences category", async () => {
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button")!.click(),
  );
  expect(hideModal).toHaveBeenCalledWith("keyboard-guide");
  expect(host.querySelector("output")?.textContent).toBe(
    "/settings?category=settings-preferences",
  );
});
