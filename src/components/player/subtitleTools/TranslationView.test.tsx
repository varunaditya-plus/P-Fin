// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { usePlayerStore } from "@/stores/player/store";

import { useSubtitleTools } from "./preferences";
import { useSubtitleToolState } from "./state";
import { TranslationView } from "./TranslationView";

vi.mock("@/hooks/useOverlayRouter", () => ({
  useOverlayRouter: () => ({ navigate: vi.fn() }),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const original = {
  id: "jellyfin-1",
  language: "en",
  srtData: "1\n00:00:02,000 --> 00:00:04,000\nHello world\n",
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useSubtitleTools.setState({
    autoSync: false,
    translationEndpoint: "https://translate.example/translate",
    targetLanguage: "es",
  });
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePlayerStore.getState().setCaption(original);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <TranslationView />
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useSubtitleToolState.setState({ translation: null, autoDelay: null });
});
it("translates a chosen named language and restores the original track", async () => {
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ translatedText: ["Hola mundo"] }),
  }));
  vi.stubGlobal("fetch", fetch);
  const spanish = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Spanish",
  )!;
  await act(async () => spanish.click());
  expect(fetch).toHaveBeenCalledOnce();
  expect(usePlayerStore.getState().caption.selected?.language).toBe("es");
  expect(usePlayerStore.getState().caption.selected?.srtData).toContain(
    "Hola mundo",
  );
  const restore = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Restore original",
  )!;
  act(() => restore.click());
  expect(usePlayerStore.getState().caption.selected).toBe(original);
});
it("aborts translation when the panel closes without changing the selected track", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }),
  );
  const spanish = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Spanish",
  )!;
  await act(async () => spanish.click());
  act(() =>
    root.render(
      <MemoryRouter>
        <div>Closed</div>
      </MemoryRouter>,
    ),
  );
  expect(signal?.aborted).toBe(true);
  expect(usePlayerStore.getState().caption.selected).toBe(original);
});
