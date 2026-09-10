// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { useJellyfinAuth } from "@/stores/jellyfin";

import {
  getTasteLibrary,
  tasteMediaFromJellyfin,
  tasteMediaFromSeerr,
} from "./catalog";

vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  jellyfinRequest: vi.fn(),
}));
let user = 0;
beforeEach(() => {
  vi.clearAllMocks();
  user += 1;
  useJellyfinAuth.setState({
    session: {
      serverUrl: "/jellyfin",
      userId: `user-${user}`,
      accessToken: "test",
      userName: "User",
      deviceId: "web",
    },
  });
});
describe("taste catalog boundaries", () => {
  it("projects in-progress episodes onto their accessible series without adding episode cards", async () => {
    vi.mocked(jellyfinRequest).mockImplementation(async (path) => {
      if (path.endsWith("/Items"))
        return {
          Items: [{ Id: "show", Name: "Show", Type: "Series" }],
          TotalRecordCount: 1,
        };
      if (path.endsWith("/Resume"))
        return {
          Items: [
            {
              Id: "episode",
              SeriesId: "show",
              Type: "Episode",
              Name: "Episode",
            },
          ],
        };
      return { Items: [] };
    });
    const result = await getTasteLibrary();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      progress: true,
      item: { Id: "show", Type: "Series" },
    });
  });
  it("joins matching Seerr/Jellyfin titles without colliding movie and TV IDs", () => {
    const library = tasteMediaFromJellyfin({
      Id: "abc",
      Name: "Movie",
      Type: "Movie",
      ProviderIds: { Tmdb: "42" },
      Genres: ["Sci-Fi"],
    });
    const seerr = tasteMediaFromSeerr({
      id: 42,
      title: "Movie",
      mediaType: "movie",
      genreIds: [878],
    });
    expect(library.key).toBe(seerr.key);
    expect(library.genres).toEqual(seerr.genres);
    expect(
      tasteMediaFromSeerr({ id: 42, name: "Show", mediaType: "tv" }).key,
    ).not.toBe(library.key);
  });
  it("paginates only the user-scoped Jellyfin library and shares in-flight requests", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Items: [{ Id: "one", Name: "One", Type: "Movie" }],
        TotalRecordCount: 2,
      })
      .mockResolvedValueOnce({
        Items: [{ Id: "two", Name: "Two", Type: "Series" }],
        TotalRecordCount: 2,
      });
    const [first, second] = await Promise.all([
      getTasteLibrary(),
      getTasteLibrary(),
    ]);
    expect(first.map((item) => item.item.Id)).toEqual(["one", "two"]);
    expect(second).toBe(first);
    expect(
      vi
        .mocked(jellyfinRequest)
        .mock.calls.filter(([path]) => path === `Users/user-${user}/Items`),
    ).toHaveLength(2);
    expect(vi.mocked(jellyfinRequest).mock.calls[0][0]).toBe(
      `Users/user-${user}/Items`,
    );
    expect(vi.mocked(jellyfinRequest).mock.calls[1][2]).toMatchObject({
      StartIndex: 1,
      IncludeItemTypes: "Movie,Series",
    });
  });
  it("does not publish a library response into a changed account", async () => {
    vi.mocked(jellyfinRequest).mockImplementationOnce(async () => {
      useJellyfinAuth.setState({ session: null });
      return { Items: [], TotalRecordCount: 0 };
    });
    await expect(getTasteLibrary()).rejects.toThrow("account changed");
  });
});
