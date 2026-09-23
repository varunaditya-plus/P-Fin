// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";

import { CaptionsPart } from "./CaptionsPart";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/player/Player", () => ({
  CaptionCue: () => <span>Preview subtitle</span>,
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
function Harness() {
  const styling = useSubtitleStore((state) => state.styling);
  return (
    <CaptionsPart
      styling={styling}
      setStyling={useSubtitleStore.getState().updateStyling}
    />
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useSubtitleStore.setState({
    styling: { ...useSubtitleStore.getInitialState().styling },
    overrideCasing: false,
  });
  usePreferencesStore.setState({ enableNativeSubtitles: false });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <Harness />
        </HelmetProvider>
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(label: string) {
  act(() =>
    container
      .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
      .click(),
  );
}
function setValue(label: string, value: string) {
  click(`Edit ${label.toLowerCase()}`);
  const input = container.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  )!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => input.blur());
}
it("updates the shared letter spacing and rounding settings, then resets the complete appearance", () => {
  setValue("Letter spacing", "2.5");
  setValue("Corner rounding", "12");
  expect(useSubtitleStore.getState().styling).toMatchObject({
    letterSpacing: 2.5,
    backgroundRadius: 12,
  });
  const reset = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Reset to Default",
  )!;
  expect(reset.disabled).toBe(false);
  act(() => reset.click());
  expect(useSubtitleStore.getState().styling).toEqual(
    useSubtitleStore.getInitialState().styling,
  );
  expect(reset.disabled).toBe(true);
});
it("keeps custom appearance while switching native subtitles and retains fullscreen preview controls", async () => {
  setValue("Letter spacing", "1.5");
  click("player.menus.subtitles.settings.fixCapitals");
  expect(useSubtitleStore.getState().overrideCasing).toBe(true);
  click("player.menus.subtitles.useNativeSubtitles");
  expect(container.textContent).not.toContain("Text & Typography");
  expect(useSubtitleStore.getState().styling.letterSpacing).toBe(1.5);
  click("player.menus.subtitles.useNativeSubtitles");
  expect(container.textContent).toContain("Text & Typography");
  click("Expand subtitle preview");
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  });
  expect(
    container.querySelector('[aria-label="Close subtitle preview"]'),
  ).not.toBeNull();
  act(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  });
  expect(
    container.querySelector('[aria-label="Close subtitle preview"]'),
  ).toBeNull();
  expect(useSubtitleStore.getState().styling.letterSpacing).toBe(1.5);
});
