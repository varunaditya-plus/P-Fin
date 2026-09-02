import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentItem,
  contentImageUrl,
  getLocalTrailers,
  getSpecialFeatures,
} from "@/backend/jellyfin/content";

import { ContentInformation } from "./ContentInformation";

vi.mock("@headlessui/react", () => ({
  Transition: ({ children, show }: { children: ReactNode; show: boolean }) => (
    <div hidden={!show}>{children}</div>
  ),
}));
vi.mock("@/backend/jellyfin/client", () => ({ getImageUrl: () => "" }));
vi.mock("@/backend/jellyfin/content", () => ({
  contentImageUrl: vi.fn(() => "/chapter.jpg"),
  getLocalTrailers: vi.fn(async () => []),
  getSpecialFeatures: vi.fn(async () => []),
  safeExternalUrl: (value?: string) =>
    value?.startsWith("https://") ? value : undefined,
}));

let root: Root;
let container: HTMLDivElement;
const play = vi.fn();

async function renderContent(item: ContentItem, playbackItem?: ContentItem) {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ContentInformation
          item={item}
          playbackItem={playbackItem}
          onPlay={play}
        />
      </MemoryRouter>,
    ),
  );
}

function button(name: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.includes(name),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Jellyfin content information disclosure", () => {
  it("starts collapsed and loads extras only after the user opens their tab", async () => {
    const movie: ContentItem = { Id: "movie", Name: "Film", Type: "Movie" };
    await renderContent(movie);
    expect(button("More details")?.getAttribute("aria-expanded")).toBe("false");
    expect(getSpecialFeatures).not.toHaveBeenCalled();
    await act(async () => button("More details")?.click());
    expect(getSpecialFeatures).not.toHaveBeenCalled();
    await act(async () => button("Extras & trailers")?.click());
    expect(getSpecialFeatures).toHaveBeenCalledWith(
      "movie",
      expect.any(AbortSignal),
    );
    expect(getLocalTrailers).toHaveBeenCalledWith(
      "movie",
      expect.any(AbortSignal),
    );
    await act(async () => button("Hide details")?.click());
    await renderContent({ ...movie, Id: "other", Name: "Other film" });
    expect(button("More details")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses the selected episode for technical details and chapter playback", async () => {
    const series: ContentItem = { Id: "series", Name: "Show", Type: "Series" };
    const episode: ContentItem = {
      Id: "episode",
      Name: "Pilot",
      Type: "Episode",
      MediaSources: [{ Id: "source", Name: "HD", Container: "mkv" }],
      Chapters: [
        { Name: "Opening", StartPositionTicks: 100000000, ImageTag: "tag" },
      ],
    };
    await renderContent(series, episode);
    await act(async () => button("More details")?.click());
    await act(async () => button("Media info")?.click());
    expect(container.textContent).toContain("Episode: Pilot");
    expect(container.textContent).toContain("MKV");
    await act(async () => button("Chapters")?.click());
    expect(contentImageUrl).toHaveBeenCalledWith(
      "episode",
      "Chapter",
      0,
      "tag",
    );
    await act(async () => button("Opening")?.click());
    expect(play).toHaveBeenCalledWith(episode, 100000000);
  });
});
