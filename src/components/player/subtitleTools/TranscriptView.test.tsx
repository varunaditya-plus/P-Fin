// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";

import { TranscriptView } from "./TranscriptView";

vi.mock("@/hooks/useOverlayRouter", () => ({
  useOverlayRouter: () => ({ navigate: vi.fn() }),
}));
vi.mock("@/components/player/internals/ContextMenu", () => ({
  Menu: {
    CardWithScrollable: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Section: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BackLink: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
}));
afterEach(() => {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useSubtitleStore.setState({ delay: 0 });
  vi.unstubAllGlobals();
});
it("seeks transcript lines with the selected subtitle delay and highlights the current line", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const seek = vi.fn();
  usePlayerStore.setState((state) => {
    state.caption.selected = {
      id: "text",
      language: "eng",
      srtData: "1\n00:00:02,000 --> 00:00:04,000\nFind this dialogue\n",
    };
    state.progress.time = 5;
    state.display = { setTime: seek } as unknown as DisplayInterface;
  });
  useSubtitleStore.setState({ delay: 3 });
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<TranscriptView />));
  const cue = container.querySelector<HTMLButtonElement>(
    'button[aria-current="true"]',
  );
  expect(cue?.textContent).toContain("Find this dialogue");
  act(() => cue?.click());
  expect(seek).toHaveBeenCalledWith(5);
  act(() => root.unmount());
});
