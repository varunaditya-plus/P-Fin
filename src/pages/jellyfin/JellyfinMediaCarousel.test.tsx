import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaCardProps } from "@/components/media/MediaCard";

import { JellyfinMediaCard } from "./JellyfinMediaCarousel";

vi.mock("@/backend/jellyfin/client", () => ({
  getImageUrl: () => undefined,
  getEpisodes: vi.fn(),
  setFavorite: vi.fn(),
  setPlayed: vi.fn(),
}));
vi.mock("@/backend/jellyfin/content", () => ({
  getContentItem: vi.fn(),
  getContentPolicy: vi.fn(),
}));
vi.mock("@/components/media/MediaCard", () => ({
  MediaCardSkeleton: () => null,
  MediaCard: ({ media, percentage, series, onShowDetails }: MediaCardProps) => (
    <button
      type="button"
      data-item-id={media.id}
      data-episode-id={series?.episodeId}
      data-progress={percentage}
      onClick={() => onShowDetails?.(media)}
    >
      Details
    </button>
  ),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Jellyfin episode cards", () => {
  it("opens series details while preserving the Continue Watching episode's badge and progress", () => {
    const select = vi.fn();
    act(() =>
      root.render(
        <JellyfinMediaCard
          item={{
            Id: "episode",
            Name: "Episode",
            Type: "Episode",
            SeriesId: "series",
            SeriesName: "Series",
            SeasonId: "season",
            ParentIndexNumber: 2,
            IndexNumber: 3,
            RunTimeTicks: 200_000_000,
            UserData: { PlaybackPositionTicks: 50_000_000 },
          }}
          onSelect={select}
        />,
      ),
    );
    const card = container.querySelector("button")!;
    expect(card.dataset.itemId).toBe("episode");
    expect(card.dataset.episodeId).toBe("episode");
    expect(card.dataset.progress).toBe("25");
    act(() => card.click());
    expect(select).toHaveBeenCalledWith({
      Id: "series",
      Type: "Series",
      Name: "Series",
    });
  });
});
