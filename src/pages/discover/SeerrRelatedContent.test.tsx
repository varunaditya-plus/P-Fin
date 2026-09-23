import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSeerrCollection, getSeerrSimilar } from "@/backend/seerr/related";

import {
  SeerrCollectionButton,
  SeerrRelatedContent,
} from "./SeerrRelatedContent";

vi.mock("@/backend/seerr/related", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/related")>()),
  getSeerrCollection: vi.fn(),
  getSeerrSimilar: vi.fn(),
}));
vi.mock("@/components/media/MediaCard", () => ({
  MediaCard: ({
    media,
    onShowDetails,
  }: {
    media: { title: string };
    onShowDetails: () => void;
  }) => (
    <button type="button" data-media-card onClick={onShowDetails}>
      {media.title}
    </button>
  ),
  MediaCardSkeleton: () => <div />,
}));
vi.mock("./components/CarouselNavButtons", () => ({
  CarouselNavButtons: () => null,
}));
let host: HTMLDivElement;
let root: Root;
const select = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

      unobserve = vi.fn();

      disconnect = vi.fn();
    },
  );
  vi.clearAllMocks();
  vi.mocked(getSeerrSimilar).mockResolvedValue([
    { id: 2, mediaType: "movie", title: "Similar film" },
  ]);
  vi.mocked(getSeerrCollection).mockResolvedValue({
    id: 5,
    name: "Films",
    parts: [
      {
        id: 1,
        mediaType: "movie",
        title: "First",
        releaseDate: "2000-01-01",
        voteAverage: 6,
      },
      {
        id: 2,
        mediaType: "movie",
        title: "Second",
        releaseDate: "2010-01-01",
        voteAverage: 9,
      },
    ],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("Seerr related content", () => {
  it("opens a collection, sorts its titles and routes a selected film to details", async () => {
    await act(async () =>
      root.render(
        <HelmetProvider>
          <MemoryRouter>
            <SeerrCollectionButton
              collection={{ id: 5, name: "Films" }}
              onSelect={select}
            />
          </MemoryRouter>
        </HelmetProvider>,
      ),
    );
    await act(async () => host.querySelector("button")!.click());
    expect(
      [...document.querySelectorAll("[data-media-card]")].map(
        (card) => card.textContent,
      ),
    ).toEqual(["First", "Second"]);
    const rating = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Rating",
    )!;
    await act(async () => rating.click());
    expect(
      [...document.querySelectorAll("[data-media-card]")].map(
        (card) => card.textContent,
      ),
    ).toEqual(["Second", "First"]);
    await act(async () =>
      document.querySelector<HTMLButtonElement>("[data-media-card]")!.click(),
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, mediaType: "movie" }),
    );
  });
  it("loads related titles when visible and removes trailer playback on Escape", async () => {
    await act(async () =>
      root.render(
        <HelmetProvider>
          <MemoryRouter>
            <SeerrRelatedContent
              details={{
                id: 1,
                mediaType: "movie",
                relatedVideos: [
                  {
                    key: "abcdefghijk",
                    name: "Official trailer",
                    site: "YouTube",
                    type: "Trailer",
                  },
                ],
              }}
              onSelect={select}
            />
          </MemoryRouter>
        </HelmetProvider>,
      ),
    );
    expect(getSeerrSimilar).toHaveBeenCalledWith(
      1,
      "movie",
      expect.any(AbortSignal),
    );
    await act(async () =>
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Official trailer")!
        .click(),
    );
    expect(
      document.querySelector("iframe")?.getAttribute("referrerpolicy"),
    ).toBe("strict-origin-when-cross-origin");
    expect(document.querySelector("iframe")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0",
    );
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector("iframe")).toBeNull();
  });
});
