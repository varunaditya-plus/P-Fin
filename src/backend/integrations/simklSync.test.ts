/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem, jellyfinRequest } from "@/backend/jellyfin/client";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { integrationIdentity, integrationLibrary } from "./library";
import { requireSimklConnection, simklRequest } from "./simkl";
import {
  SimklSyncPlan,
  applySimklSync,
  previewSimklSync,
  watchedEpisodeMatches,
} from "./simklSync";

vi.mock("./library", async (original) => ({
  ...(await original<object>()),
  integrationLibrary: vi.fn(),
}));
vi.mock("./simkl", () => ({
  requireSimklConnection: vi.fn(),
  simklRequest: vi.fn(),
}));
vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<object>()),
  jellyfinRequest: vi.fn(),
}));
const session = {
  serverUrl: "/jellyfin",
  userId: "user",
  accessToken: "jf-test",
  userName: "User",
  deviceId: "test",
};
const show: JellyfinItem = {
  Id: "a".repeat(32),
  Type: "Series",
  Name: "A show",
  ProviderIds: { Tmdb: "100", Tvdb: "200" },
};
const episode: JellyfinItem = {
  Id: "b".repeat(32),
  Type: "Episode",
  Name: "Episode 2",
  SeriesId: show.Id,
  ParentIndexNumber: 2,
  IndexNumber: 2,
  ProviderIds: { Tvdb: "900" },
  UserData: { Played: true },
};
beforeEach(() => {
  vi.resetAllMocks();
  useJellyfinAuth.getState().setSession(session);
  vi.mocked(requireSimklConnection).mockReturnValue({
    accessToken: "simkl-test",
  } as ReturnType<typeof requireSimklConnection>);
  vi.mocked(simklRequest).mockResolvedValue({});
});
describe("Simkl mapping and additive sync", () => {
  it("keeps movie and show export failures separate when TMDB numbers overlap", async () => {
    const plan: SimklSyncPlan = {
      mode: "export-watched",
      identity: integrationIdentity(),
      connectionToken: "simkl-test",
      skipped: [],
      rows: [
        {
          key: "movie:100",
          title: "Movie",
          detail: "",
          bucket: "movies",
          payload: { ids: { tmdb: 100 }, type: "movie" },
        },
        {
          key: "show:100",
          title: "Series",
          detail: "",
          bucket: "shows",
          payload: { ids: { tmdb: 100 }, type: "show" },
        },
      ],
    };
    vi.mocked(simklRequest).mockResolvedValueOnce({
      not_found: { movies: [{ ids: { tmdb: 100 } }], shows: [] },
    });
    const result = await applySimklSync(
      plan,
      new Set(plan.rows.map((row) => row.key)),
      new AbortController().signal,
      vi.fn(),
    );
    expect(result.applied).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].title).toBe("Movie");
  });
  it("does not treat anime sequential numbering as Jellyfin season numbering", () => {
    const remote = {
      status: "completed",
      seasons: [{ number: 2, episodes: [{ number: 2 }] }],
    };
    expect(watchedEpisodeMatches(episode, remote, true)).toBe(false);
    expect(watchedEpisodeMatches(episode, remote, false)).toBe(true);
    expect(
      watchedEpisodeMatches(
        episode,
        {
          ...remote,
          seasons: [
            { number: 1, episodes: [{ number: 14, ids: { tvdb_id: 900 } }] },
          ],
        },
        true,
      ),
    ).toBe(true);
  });
  it("exports only explicit watched episodes and supplies TVDB anime numbering", async () => {
    vi.mocked(integrationLibrary).mockResolvedValue([
      show,
      episode,
      {
        ...episode,
        Id: "c".repeat(32),
        IndexNumber: 3,
        UserData: { Played: false },
      },
    ]);
    const plan = await previewSimklSync(
      "export-watched",
      new AbortController().signal,
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].payload).toMatchObject({
      type: "show",
      use_tvdb_anime_seasons: true,
      seasons: [{ number: 2, episodes: [{ number: 2 }] }],
    });
    expect(plan.rows[0].payload).not.toHaveProperty("status");
  });
  it("does not import whole-series completion without recorded episodes", async () => {
    vi.mocked(integrationLibrary).mockResolvedValue([
      show,
      { ...episode, UserData: { Played: false } },
    ]);
    vi.mocked(simklRequest)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        shows: [
          {
            status: "completed",
            show: { title: "A show", ids: { tmdb: 100 } },
          },
        ],
      });
    const plan = await previewSimklSync(
      "import-watched",
      new AbortController().signal,
    );
    expect(plan.rows).toEqual([]);
    expect(jellyfinRequest).not.toHaveBeenCalled();
  });
  it("imports only completed matched movies and individually recorded episodes", async () => {
    const film: JellyfinItem = {
      Id: "d".repeat(32),
      Type: "Movie",
      Name: "Film",
      ProviderIds: { Tmdb: "300" },
      UserData: { Played: false },
    };
    vi.mocked(integrationLibrary).mockResolvedValue([
      film,
      show,
      { ...episode, UserData: { Played: false } },
    ]);
    vi.mocked(simklRequest)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        movies: [
          { status: "completed", movie: { title: "Film", ids: { tmdb: 300 } } },
          {
            status: "plantowatch",
            movie: { title: "Unwatched", ids: { tmdb: 400 } },
          },
        ],
        shows: [
          {
            status: "watching",
            show: { title: show.Name, ids: { tmdb: 100 } },
            seasons: [{ number: 2, episodes: [{ number: 2 }] }],
          },
        ],
      });
    const signal = new AbortController().signal;
    const plan = await previewSimklSync("import-watched", signal);
    expect(plan.rows.map((row) => row.itemId)).toEqual([film.Id, episode.Id]);
    vi.mocked(jellyfinRequest).mockResolvedValue({
      UserData: { Played: false },
    });
    const result = await applySimklSync(
      plan,
      new Set(plan.rows.map((row) => row.key)),
      signal,
      vi.fn(),
    );
    expect(result).toEqual({ applied: 2, failures: [] });
    expect(
      vi
        .mocked(jellyfinRequest)
        .mock.calls.filter(([, init]) => init?.method === "POST")
        .map(([path]) => path),
    ).toEqual([
      `Users/${session.userId}/PlayedItems/${film.Id}`,
      `Users/${session.userId}/PlayedItems/${episode.Id}`,
    ]);
  });
  it("batches exports and treats HTTP-success not_found records as failures", async () => {
    const plan: SimklSyncPlan = {
      mode: "export-watched",
      identity: integrationIdentity(),
      connectionToken: "simkl-test",
      skipped: [],
      rows: Array.from({ length: 51 }, (_, index) => ({
        key: String(index + 1),
        title: `Film ${index + 1}`,
        detail: "",
        bucket: "movies",
        payload: { ids: { tmdb: index + 1 }, type: "movie" },
      })),
    };
    vi.mocked(simklRequest)
      .mockResolvedValueOnce({ not_found: { movies: [{ ids: { tmdb: 2 } }] } })
      .mockResolvedValueOnce({});
    const result = await applySimklSync(
      plan,
      new Set(plan.rows.map((row) => row.key)),
      new AbortController().signal,
      vi.fn(),
    );
    expect(simklRequest).toHaveBeenCalledTimes(2);
    expect(
      vi
        .mocked(simklRequest)
        .mock.calls.every(([path]) => path === "/sync/history"),
    ).toBe(true);
    expect(result.applied).toBe(50);
    expect(result.failures[0].title).toBe("Film 2");
  });
});
