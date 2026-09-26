// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CaptionCue } from "@/components/player/base/SubtitleView";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";

import {
  CaptionSettingsView,
  SubtitleLayoutControls,
} from "./CaptionSettingsView";

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
it("applies saved spacing and rounding to rendered subtitle text while retaining line-height and colour", () => {
  act(() =>
    root.render(
      <CaptionCue
        text={"One line\nAnother line"}
        overrideCasing={false}
        styling={{
          ...useSubtitleStore.getState().styling,
          letterSpacing: 2.5,
          backgroundRadius: 12,
          lineHeight: 1.9,
          color: "#ffeebb",
        }}
      />,
    ),
  );
  const cue = container.querySelector("p")!;
  expect(cue.style.letterSpacing).toBe("2.5px");
  expect(cue.style.borderRadius).toBe("12px");
  expect(cue.style.lineHeight).toBe("1.9");
  expect(cue.style.color).toBe("rgb(255, 238, 187)");
  expect(cue.querySelector("br")).not.toBeNull();
});
it("allows direct editing of letter spacing without changing other appearance settings", () => {
  const styling = useSubtitleStore.getState().styling;
  const changed = vi.fn();
  act(() =>
    root.render(
      <SubtitleLayoutControls styling={styling} onChange={changed} />,
    ),
  );
  act(() =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Edit letter spacing"]')!
      .click(),
  );
  const field = container.querySelector<HTMLInputElement>(
    '[aria-label="Letter spacing"]',
  )!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, "1.25");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => field.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(changed).toHaveBeenCalledWith({ ...styling, letterSpacing: 1.3 });
});

it("keeps native presentation requirements when opening subtitle appearance", () => {
  usePlayerStore.getState().setCaptionAsTrack(true);
  usePreferencesStore.setState({ enableNativeSubtitles: false });
  act(() =>
    root.render(
      <MemoryRouter>
        <CaptionSettingsView id="settings" />
      </MemoryRouter>,
    ),
  );
  expect(usePlayerStore.getState().caption.asTrack).toBe(true);
  usePlayerStore.getState().setCaptionAsTrack(false);
});
