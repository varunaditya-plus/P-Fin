import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JellyfinItem,
  getEpisodes,
  setFavorite,
  setPlayed,
} from "@/backend/jellyfin/client";
import { getContentPolicy } from "@/backend/jellyfin/content";
import { resetResumePoint } from "@/backend/jellyfin/progress";

import { JellyfinCardMenu } from "./JellyfinCardMenu";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/backend/jellyfin/client", () => ({
  getEpisodes: vi.fn(),
  setFavorite: vi.fn(),
  setPlayed: vi.fn(),
}));
vi.mock("@/backend/jellyfin/content", () => ({
  getContentPolicy: vi.fn(),
  getContentItem: vi.fn(),
}));
vi.mock("@/backend/jellyfin/progress", () => ({ resetResumePoint: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
const select = vi.fn();
const changed = vi.fn();
const close = vi.fn();
const movie: JellyfinItem = {
  Id: "movie-id",
  Name: "Movie",
  Type: "Movie",
  UserData: { Played: false, IsFavorite: false },
};

async function render(item: JellyfinItem = movie) {
  await act(async () =>
    root.render(
      <JellyfinCardMenu
        item={item}
        onSelect={select}
        onChanged={changed}
        close={close}
      />,
    ),
  );
}
async function choose(label: string) {
  const action = [
    ...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  ].find((button) => button.textContent?.includes(label));
  expect(action, `Missing action ${label}`).toBeDefined();
  await act(async () => action!.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.mocked(getContentPolicy).mockResolvedValue({
    EnableCollectionManagement: true,
  });
  vi.mocked(setFavorite).mockResolvedValue(undefined);
  vi.mocked(setPlayed).mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Jellyfin card actions", () => {
  it("explains and confirms a resume reset without changing watched or favourite state", async () => {
    vi.mocked(resetResumePoint).mockResolvedValue({
      PlaybackPositionTicks: 0,
      Played: false,
      IsFavorite: true,
    });
    await render({
      ...movie,
      UserData: { PlaybackPositionTicks: 100, Played: false, IsFavorite: true },
    });
    await choose("Remove from Continue Watching");
    expect(resetResumePoint).not.toHaveBeenCalled();
    expect(container.textContent).toContain("resets the saved resume point");
    await choose("Reset resume point");
    expect(resetResumePoint).toHaveBeenCalledWith(movie.Id);
    expect(changed).toHaveBeenCalledWith({
      PlaybackPositionTicks: 0,
      Played: false,
      IsFavorite: true,
    });
    expect(setPlayed).not.toHaveBeenCalled();
    expect(setFavorite).not.toHaveBeenCalled();
  });
  it("does not expose resume reset when Jellyfin denies preference changes", async () => {
    vi.mocked(getContentPolicy).mockResolvedValue({
      EnableUserPreferenceAccess: false,
    } as Awaited<ReturnType<typeof getContentPolicy>>);
    await render({ ...movie, UserData: { PlaybackPositionTicks: 100 } });
    expect(container.textContent).not.toContain(
      "Remove from Continue Watching",
    );
  });
  it("opens series details from episode actions while Resume plays the original episode", async () => {
    const episode: JellyfinItem = {
      Id: "episode",
      Name: "Episode",
      Type: "Episode",
      SeriesId: "series",
      SeriesName: "Series",
      UserData: { PlaybackPositionTicks: 10_000_000 },
    };
    await render(episode);
    await choose("More info");
    expect(select).toHaveBeenCalledWith(
      { Id: "series", Name: "Series", Type: "Series" },
      undefined,
    );
    await choose("Resume");
    expect(navigate).toHaveBeenCalledWith("/play/episode");
    expect(getEpisodes).not.toHaveBeenCalled();
  });

  it("copies a series details link for episode cards", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await render({
      Id: "episode",
      Name: "Episode",
      Type: "Episode",
      SeriesId: "series",
    });
    await choose("Copy link");
    expect(writeText).toHaveBeenCalledWith(
      new URL("/?item=series", window.location.origin).toString(),
    );
  });

  it("focuses and selects the fallback URL when clipboard access is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await render();
    await choose("Copy link");
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Link to this title"]',
    )!;
    expect(writeText).toHaveBeenCalledWith(
      new URL("/?item=movie-id", window.location.origin).toString(),
    );
    expect(document.activeElement).toBe(input);
    expect(input.readOnly).toBe(true);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(close).not.toHaveBeenCalled();
  });

  it("plays the series episode with a saved resume position from accessible Jellyfin episodes", async () => {
    vi.mocked(getEpisodes).mockResolvedValue([
      { Id: "special", Name: "Special", Type: "Episode", ParentIndexNumber: 0 },
      {
        Id: "watched",
        Name: "Watched",
        Type: "Episode",
        ParentIndexNumber: 1,
        UserData: { Played: true },
      },
      {
        Id: "resume",
        Name: "Continue",
        Type: "Episode",
        ParentIndexNumber: 1,
        UserData: { PlaybackPositionTicks: 100_000_000 },
      },
    ]);
    await render({ Id: "series", Name: "Series", Type: "Series" });
    await choose("Play now");
    expect(getEpisodes).toHaveBeenCalledWith("series");
    expect(navigate).toHaveBeenCalledWith("/play/resume");
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports unavailable series instead of opening an invalid player route", async () => {
    vi.mocked(getEpisodes).mockResolvedValue([]);
    await render({ Id: "series", Name: "Series", Type: "Series" });
    await choose("Play now");
    expect(navigate).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "No episodes are available",
    );
  });

  it.each(["collection", "playlist"] as const)(
    "opens the details editor with the %s intent",
    async (intent) => {
      await render();
      await choose(`Add to ${intent}`);
      expect(select).toHaveBeenCalledWith(movie, intent);
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("writes favourites to Jellyfin and tells the card to refresh its user data", async () => {
    await render();
    await choose("Add to favourites");
    expect(setFavorite).toHaveBeenCalledWith("movie-id", true);
    expect(changed).toHaveBeenCalledWith({ Played: false, IsFavorite: true });
    expect(close).toHaveBeenCalledOnce();
  });

  it("writes watched state to Jellyfin and refreshes only after success", async () => {
    await render();
    await choose("Mark as watched");
    expect(setPlayed).toHaveBeenCalledWith("movie-id", true);
    expect(changed).toHaveBeenCalledWith({ Played: true, IsFavorite: false });
    expect(close).toHaveBeenCalledOnce();
  });

  it("refreshes the parent after a successful write even if the menu was dismissed", async () => {
    let finishWrite: ((value: undefined) => void) | undefined;
    vi.mocked(setFavorite).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    );
    await render();
    await choose("Add to favourites");
    expect(changed).not.toHaveBeenCalled();
    act(() => root.render(null));
    await act(async () => finishWrite?.(undefined));
    expect(changed).toHaveBeenCalledWith({ Played: false, IsFavorite: true });
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps mutation errors visible without updating local state", async () => {
    vi.mocked(setFavorite).mockRejectedValueOnce(new Error("Access denied"));
    await render();
    await choose("Add to favourites");
    expect(changed).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Access denied",
    );
  });
});
