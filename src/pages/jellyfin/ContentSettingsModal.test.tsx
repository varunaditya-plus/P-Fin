// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentItem,
  contentStreamUrl,
  getContentContainers,
  getContentPolicy,
  getMetadataEditorInfo,
} from "@/backend/jellyfin/content";
import { DetailsModalFrame } from "@/components/overlays/DetailsModalFrame";

import { ContentSettingsModal } from "./ContentSettingsModal";

vi.mock("@/backend/jellyfin/content", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/content")>()),
  getContentPolicy: vi.fn(),
  getContentContainers: vi.fn(),
  getMetadataEditorInfo: vi.fn(),
  contentStreamUrl: vi.fn(() => "https://example.test/private-stream"),
}));

const series: ContentItem = {
  Id: "series",
  Name: "A series",
  Type: "Series",
  MediaSources: [{ Id: "wrong-series-source", Name: "Wrong source" }],
};
const episode: ContentItem = {
  Id: "episode",
  Name: "Pilot",
  Type: "Episode",
  ParentIndexNumber: 1,
  IndexNumber: 1,
  UserData: { PlaybackPositionTicks: 100 },
  MediaSources: [
    {
      Id: "1080",
      Name: "1080p",
      MediaStreams: [
        { Index: 1, Type: "Audio", DisplayTitle: "English" },
        { Index: 4, Type: "Subtitle", DisplayTitle: "English subtitles" },
      ],
    },
    { Id: "4k", Name: "4K", MediaStreams: [] },
  ],
};
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const sourceChanged = vi.fn();
const tracksChanged = vi.fn();
const parentClosed = vi.fn();
const playbackRestarted = vi.fn();

function Harness({ playable = episode }: { playable?: ContentItem | null }) {
  const [open, setOpen] = useState(true);
  return (
    <MemoryRouter>
      <HelmetProvider>
        <DetailsModalFrame
          open
          onClose={parentClosed}
          afterLeave={() => {}}
          label="Series details"
        >
          <button type="button" onClick={() => setOpen(true)}>
            Open settings
          </button>
          <ContentSettingsModal
            open={open}
            onClose={() => setOpen(false)}
            item={series}
            playbackItem={playable}
            sourceId="1080"
            onSourceChange={sourceChanged}
            tracks={{}}
            onTracksChange={tracksChanged}
            onSaved={async () => {}}
            onDeleted={() => {}}
            onPlayFromBeginning={playbackRestarted}
          />
        </DetailsModalFrame>
      </HelmetProvider>
    </MemoryRouter>
  );
}
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(650);
  });
}
function button(text: string) {
  return [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === text,
  )!;
}
function select(label: string) {
  return [...document.querySelectorAll("label")]
    .find((entry) => entry.querySelector("span")?.textContent === label)!
    .querySelector("select")!;
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.mocked(getContentPolicy).mockResolvedValue({
    IsAdministrator: true,
    EnableContentDownloading: true,
  });
  vi.mocked(getContentContainers).mockResolvedValue([]);
  vi.mocked(getMetadataEditorInfo).mockResolvedValue({});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  Reflect.deleteProperty(navigator, "clipboard");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("content settings modal", () => {
  it("uses the episode's versions and tracks while exposing all authorised management actions without Download", async () => {
    await act(async () => root.render(<Harness />));
    await settle();
    expect(select("Version").textContent).toContain("1080p");
    expect(select("Version").textContent).not.toContain("Wrong source");
    expect(select("Audio").textContent).toContain("English");
    expect(select("Subtitles").textContent).toContain("English subtitles");
    expect(button("Edit metadata")).toBeTruthy();
    expect(button("Add to collection")).toBeTruthy();
    expect(button("Download file")).toBeUndefined();
    expect(button("More actions")).toBeUndefined();
    await act(async () => {
      const version = select("Version");
      version.value = "4k";
      version.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sourceChanged).toHaveBeenCalledWith("4k");
    expect(tracksChanged).toHaveBeenCalledWith({});
    await act(async () => button("Play from beginning").click());
    expect(playbackRestarted).toHaveBeenCalledOnce();
  });
  it("does not use series media sources when no playable episode exists", async () => {
    await act(async () => root.render(<Harness playable={null} />));
    await settle();
    expect(
      document.querySelector("[data-content-settings-panel]")?.textContent,
    ).not.toContain("Wrong source");
    expect(button("Copy stream URL")).toBeUndefined();
  });
  it("copies the selected episode stream while keeping management actions attached to the series", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await act(async () => root.render(<Harness />));
    await settle();
    await act(async () => button("Copy stream URL").click());
    expect(contentStreamUrl).toHaveBeenCalledWith(episode, "1080");
    await act(async () => button("Edit metadata").click());
    await settle();
    expect(getMetadataEditorInfo).toHaveBeenCalledWith(
      "series",
      expect.any(AbortSignal),
    );
    await act(async () => button("Back").click());
    await act(async () => button("Add to playlist").click());
    await settle();
    expect(getContentContainers).toHaveBeenCalledWith(
      "Playlist",
      expect.any(AbortSignal),
    );
    expect(button("Back")).toBeTruthy();
    expect(
      document.querySelector("[data-content-settings-panel]")?.textContent,
    ).not.toContain("Playback");
  });
  it("closes settings with Escape and returns focus to the still-open detail dialog", async () => {
    await act(async () => root.render(<Harness />));
    await settle();
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await settle();
    expect(document.querySelector("[data-content-settings-panel]")).toBeNull();
    expect(
      document.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
    ).toBe("Series details");
    expect(
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    ).toBe(true);
    expect(document.documentElement.hasAttribute("data-no-scroll")).toBe(true);
    expect(parentClosed).not.toHaveBeenCalled();
  });
});
