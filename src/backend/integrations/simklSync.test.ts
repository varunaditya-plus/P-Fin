/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem, jellyfinRequest } from "@/backend/jellyfin/client";
import { useIntegrationWatchlist } from "@/stores/integrations/watchlist";
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
  useIntegrationWatchlist.setState({ profiles: {} });
  vi.mocked(requireSimklConnection).mockReturnValue({
    accessToken: "simkl-test",
  } as ReturnType<typeof requireSimklConnection>);
  vi.mocked(simklRequest).mockResolvedValue({});
});
describe("Simkl mapping and additive sync", () => {
  it("keeps movie and show export failures separate when TMDB numbers overlap", async () => {
    const plan: SimklSyncPlan = {
      mode: "export-watchlist",
      identity: integrationIdentity(),
      connectionToken: "simkl-test",
      skipped: [],
      rows: [
        {
          key: "movie:100",
          title: "Movie",
          detail: "",
          bucket: "movies",
          payload: { ids: { tmdb: 100 }, to: "plantowatch" },
        },
        {
          key: "show:100",
          title: "Series",
          detail: "",
          bucket: "shows",
          payload: { ids: { tmdb: 100 }, to: "plantowatch" },
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
  it("never downgrades Simkl watched/watching entries when exporting the watchlist", async () => {
    vi.mocked(integrationLibrary).mockResolvedValue([]);
    useIntegrationWatchlist.getState().merge(integrationIdentity().scope, [
      {
        key: "tmdb:tv:100",
        title: "A show",
        type: "tv",
        tmdbId: 100,
        addedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(simklRequest)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        shows: [
          { status: "watching", show: { title: "A show", ids: { tmdb: 100 } } },
        ],
      });
    const plan = await previewSimklSync(
      "export-watchlist",
      new AbortController().signal,
    );
    expect(plan.rows).toEqual([]);
    expect(plan.skipped[0].reason).toContain("existing status is preserved");
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
  it("batches exports and treats HTTP-success not_found records as failures", async () => {
    const plan: SimklSyncPlan = {
      mode: "export-watchlist",
      identity: integrationIdentity(),
      connectionToken: "simkl-test",
      skipped: [],
      rows: Array.from({ length: 51 }, (_, index) => ({
        key: String(index + 1),
        title: `Film ${index + 1}`,
        detail: "",
        bucket: "movies",
        payload: { ids: { tmdb: index + 1 }, to: "plantowatch" },
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
    expect(result.applied).toBe(50);
    expect(result.failures[0].title).toBe("Film 2");
  });
});
