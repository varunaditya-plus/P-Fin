import { act, useState } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useLocation } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEpisodes,
  getSeasons,
  getSimilarItems,
} from "@/backend/jellyfin/client";
import {
  ContentItem,
  getContentItem,
  getContentPolicy,
} from "@/backend/jellyfin/content";

import { JellyfinDetailsModal } from "./JellyfinDetailsModal";

vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  getImageUrl: () => undefined,
  getJellyfinSession: () => ({
    serverUrl: "/jellyfin",
    accessToken: "test-token",
    userId: "user",
    userName: "Test",
    deviceId: "device",
  }),
  getEpisodes: vi.fn(),
  getSeasons: vi.fn(),
  getSimilarItems: vi.fn(),
}));
vi.mock("@/backend/jellyfin/content", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/content")>()),
  getContentItem: vi.fn(),
  getContentPolicy: vi.fn(),
}));
vi.mock("@/stores/preferences", () => ({
  usePreferencesStore: (selector?: (state: object) => unknown) => {
    const state = { enableImageLogos: false, enableLowPerformanceMode: true };
    return selector ? selector(state) : state;
  },
}));
// Management editors and technical metadata do not participate in details/playback routing.
vi.mock("./ContentActions", () => ({ ContentActions: () => null }));
vi.mock("./ContentContainerManagement", () => ({
  ContentContainerManagement: () => null,
}));
vi.mock("./ContentInformation", () => ({ ContentInformation: () => null }));

const series: ContentItem = {
  Id: "series",
  Type: "Series",
  Name: "Example Series",
};
const resume: ContentItem = {
  Id: "resume-episode",
  Type: "Episode",
  Name: "Resume Episode",
  SeriesId: "series",
  SeriesName: "Example Series",
  SeasonId: "season-2",
  ParentIndexNumber: 2,
  IndexNumber: 3,
  UserData: { PlaybackPositionTicks: 50_000_000 },
  MediaSources: [
    {
      Id: "episode-main",
      Name: "Original",
      MediaStreams: [
        { Index: 1, Type: "Audio", DisplayTitle: "English" },
        { Index: 2, Type: "Audio", DisplayTitle: "Japanese" },
        { Index: 3, Type: "Subtitle", DisplayTitle: "English subtitles" },
      ],
    },
    {
      Id: "episode-alt",
      Name: "Alternate version",
      MediaStreams: [
        { Index: 5, Type: "Audio", DisplayTitle: "Spanish" },
        { Index: 6, Type: "Subtitle", DisplayTitle: "French subtitles" },
      ],
    },
  ],
};
const other: ContentItem = {
  Id: "other-episode",
  Type: "Episode",
  Name: "Other Episode",
  SeriesId: "series",
  SeasonId: "season-2",
  ParentIndexNumber: 2,
  IndexNumber: 4,
  MediaSources: [{ Id: "other-source" }],
};
const movie: ContentItem = {
  Id: "movie",
  Type: "Movie",
  Name: "Other Movie",
  MediaSources: [{ Id: "movie-source" }],
};
let root: Root;
let container: HTMLDivElement;
let changeSelection: (value: string) => void;
const close = vi.fn();

function Harness({ requestedId }: { requestedId: string }) {
  const [itemId, setItemId] = useState<string | undefined>(requestedId);
  changeSelection = setItemId;
  const location = useLocation();
  return (
    <>
      <output data-location>
        {location.pathname}
        {location.search}
      </output>
      <JellyfinDetailsModal
        itemId={itemId}
        onClose={() => {
          close();
          setItemId(undefined);
        }}
      />
    </>
  );
}
const settle = async () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(650);
  });
async function render(id = "resume-episode") {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HelmetProvider>
          <Harness requestedId={id} />
        </HelmetProvider>
      </MemoryRouter>,
    ),
  );
  await settle();
}
async function clickLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  expect(button, `Missing button ${label}`).not.toBeNull();
  await act(async () => button!.click());
  await settle();
}
async function selectValue(label: string, value: string) {
  const element = [...document.querySelectorAll("label")]
    .find((entry) => entry.querySelector("span")?.textContent === label)
    ?.querySelector("select");
  expect(element, `Missing select ${label}`).not.toBeNull();
  await act(async () => {
    element!.value = value;
    element!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function locationUrl() {
  return new URL(
    container.querySelector("[data-location]")!.textContent!,
    window.location.origin,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  vi.clearAllMocks();
  vi.spyOn(window, "open").mockReturnValue(null);
  vi.mocked(getContentPolicy).mockResolvedValue({
    EnableContentDownloading: true,
  });
  vi.mocked(getSimilarItems).mockResolvedValue([]);
  vi.mocked(getContentItem).mockImplementation(async (id) => {
    const found = [series, resume, other, movie].find(
      (entry) => entry.Id === id,
    );
    if (!found) throw new Error(`Unknown item ${id}`);
    return found;
  });
  vi.mocked(getSeasons).mockResolvedValue([
    { Id: "season-1", Name: "Season 1", Type: "Season", SeriesId: "series" },
    { Id: "season-2", Name: "Season 2", Type: "Season", SeriesId: "series" },
  ]);
  vi.mocked(getEpisodes).mockImplementation(async (_seriesId, seasonId) =>
    seasonId === "season-1" ? [] : [resume, other],
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Jellyfin series details integration", () => {
  it("turns an episode deep link into series details and selects the season containing resume progress", async () => {
    await render();
    expect(
      document.querySelector('[role="dialog"][aria-label="Example Series"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[role="dialog"][aria-label="Resume Episode"]'),
    ).toBeNull();
    expect(getSimilarItems).toHaveBeenCalledWith(
      "series",
      expect.any(AbortSignal),
    );
    expect(getEpisodes).toHaveBeenCalledWith(
      "series",
      "season-2",
      expect.any(AbortSignal),
    );
    expect(document.body.textContent).toContain("Resume S2:E3");
  });

  it("plays an episode tile directly instead of opening another details dialog", async () => {
    await render();
    await clickLabel("Play episode 4: Other Episode");
    expect(locationUrl().pathname).toBe("/play/other-episode");
    expect(locationUrl().search).toBe("");
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("uses the selected episode version and tracks when resuming from series settings", async () => {
    await render();
    await clickLabel("Content settings");
    expect(
      document.querySelector("[data-content-settings-panel]")?.textContent,
    ).toContain("S2:E3 · Resume Episode");
    await selectValue("Version", "episode-alt");
    await selectValue("Audio", "5");
    await selectValue("Subtitles", "-1");
    await clickLabel("Close settings");
    const resumeButton = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Resume S2:E3"));
    expect(resumeButton).toBeDefined();
    await act(async () => resumeButton!.click());
    expect(locationUrl().pathname).toBe("/play/resume-episode");
    expect(Object.fromEntries(locationUrl().searchParams)).toEqual({
      mediaSourceId: "episode-alt",
      audioIndex: "5",
      subtitleIndex: "-1",
    });
  });

  it("does not publish an older episode result after another title is selected", async () => {
    let finishOld: ((item: ContentItem) => void) | undefined;
    vi.mocked(getContentItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    await render();
    await act(async () => changeSelection("movie"));
    await settle();
    await act(async () => finishOld?.(resume));
    await settle();
    expect(
      document.querySelector('[role="dialog"][aria-label="Other Movie"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[role="dialog"][aria-label="Example Series"]'),
    ).toBeNull();
  });

  it("targets the chosen episode's settings while keeping series details behind it", async () => {
    await render();
    await clickLabel("Settings for episode 4: Other Episode");
    expect(
      document.querySelector('[role="dialog"][aria-label="Example Series"]'),
    ).not.toBeNull();
    const settings = document.querySelector("[data-content-settings-panel]");
    expect(settings?.textContent).toContain("Other Episode");
    expect(settings?.querySelector("select")?.value).toBe("other-source");
    await clickLabel("Close settings");
    const playButton = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Play S2:E4"));
    expect(playButton).toBeDefined();
    await act(async () => playButton!.click());
    expect(locationUrl().pathname).toBe("/play/other-episode");
    expect(locationUrl().searchParams.get("mediaSourceId")).toBe(
      "other-source",
    );
  });

  it("opens the selected resume version and follows the episode chosen in settings for downloads", async () => {
    const originalId = "11111111111111111111111111111111";
    const alternateId = "22222222222222222222222222222222";
    const otherId = "33333333333333333333333333333333";
    vi.mocked(getContentItem).mockImplementation(async (id) => {
      if (id === resume.Id)
        return {
          ...resume,
          MediaSources: [
            {
              ...resume.MediaSources![0],
              Id: originalId,
              Path: "/media/original.mkv",
              Size: 1024 ** 3,
            },
            {
              ...resume.MediaSources![1],
              Id: alternateId,
              Path: "/media/alternate.mp4",
              Size: 2 * 1024 ** 3,
            },
          ],
        };
      if (id === other.Id)
        return {
          ...other,
          MediaSources: [{ Id: otherId, Path: "/media/other.mkv" }],
        };
      return series;
    });
    await render();
    await clickLabel("Content settings");
    await selectValue("Version", alternateId);
    await clickLabel("Close settings");
    await clickLabel("Download");
    const dialog = () =>
      document.querySelector('[role="dialog"][aria-label="Download content"]');
    const link = () =>
      dialog()!.querySelector<HTMLAnchorElement>("a[download]")!;
    expect(dialog()?.textContent).toContain("Resume Episode");
    expect(dialog()?.textContent).toContain("alternate.mp4");
    expect(dialog()?.textContent).toContain("2.0 GiB");
    expect(new URL(link().href).pathname).toBe(
      `/jellyfin/Items/${alternateId}/Download`,
    );
    expect(link().download).toBe("alternate.mp4");
    await selectValue("Version", originalId);
    expect(new URL(link().href).pathname).toBe(
      `/jellyfin/Items/${originalId}/Download`,
    );
    await clickLabel("Close downloads");
    await clickLabel("Settings for episode 4: Other Episode");
    await clickLabel("Close settings");
    await clickLabel("Download");
    expect(dialog()?.textContent).toContain("Other Episode");
    expect(new URL(link().href).pathname).toBe(
      `/jellyfin/Items/${otherId}/Download`,
    );
    expect(new URL(link().href).searchParams.get("ApiKey")).toBe("test-token");
    expect(close).not.toHaveBeenCalled();
    expect(locationUrl().pathname).toBe("/");
  });

  it("disables downloads when the Jellyfin account does not permit them", async () => {
    vi.mocked(getContentPolicy).mockResolvedValue({
      EnableContentDownloading: false,
    });
    await render();
    expect(
      document.querySelector<HTMLButtonElement>('button[aria-label="Download"]')
        ?.disabled,
    ).toBe(true);
    await clickLabel("Download");
    expect(
      document.querySelector('[role="dialog"][aria-label="Download content"]'),
    ).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });
});
