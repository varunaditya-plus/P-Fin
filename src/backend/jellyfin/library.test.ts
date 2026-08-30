// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem, jellyfinRequest } from "@/backend/jellyfin/client";

import {
  getCollectionItems,
  getLibraryFilters,
  getLibraryPage,
  getPlaylistItems,
} from "./library";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({ userId: "user-1" }),
  jellyfinRequest: vi.fn(),
}));

const movies = {
  Id: "library-1",
  Name: "Movies",
  Type: "CollectionFolder",
  CollectionType: "movies",
} as JellyfinItem;

beforeEach(() => {
  vi.mocked(jellyfinRequest).mockReset();
});

describe("Jellyfin library browsing", () => {
  it("sends sort and filters to the server before pagination", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [{ Id: "film", Type: "Movie" }],
      TotalRecordCount: 7,
    });
    const page = await getLibraryPage(movies, {
      startIndex: 60,
      sortBy: "ProductionYear",
      sortOrder: "Descending",
      status: "IsFavorite",
      genre: "Science Fiction",
      year: 1997,
    });
    expect(page.TotalRecordCount).toBe(7);
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]).toMatchObject({
      ParentId: "library-1",
      IncludeItemTypes: "Movie,Series",
      StartIndex: 60,
      SortBy: "ProductionYear",
      SortOrder: "Descending",
      Filters: "IsFavorite",
      Genres: "Science Fiction",
      Years: 1997,
      EnableUserData: true,
    });
  });

  it("queries collections as BoxSet items instead of movies and series", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [],
      TotalRecordCount: 0,
    });
    const collections = { ...movies, CollectionType: "boxsets" };
    await getLibraryPage(collections);
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]).toMatchObject({
      IncludeItemTypes: "BoxSet",
      ParentId: collections.Id,
    });
    await getLibraryPage({ ...movies, CollectionType: "playlists" });
    expect(vi.mocked(jellyfinRequest).mock.calls[1][2]).toMatchObject({
      IncludeItemTypes: "Playlist",
    });
    await getCollectionItems("boxset-1", 12);
    expect(vi.mocked(jellyfinRequest).mock.calls[2][2]).toMatchObject({
      ParentId: "boxset-1",
      Recursive: false,
      IncludeItemTypes: "Movie,Series,Episode,Video,Trailer,MusicVideo",
      StartIndex: 12,
    });
    await getPlaylistItems("playlist-1", 60);
    const [path, , query] = vi.mocked(jellyfinRequest).mock.calls[3];
    expect(path).toBe("Playlists/playlist-1/Items");
    expect(query).toMatchObject({
      UserId: "user-1",
      StartIndex: 60,
      Limit: 60,
    });
  });

  it("gets genre and year choices from the selected user-visible library", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Genres: ["Drama", "Action"],
      Years: [2022, 1997],
    });
    await expect(getLibraryFilters(movies)).resolves.toEqual({
      Genres: ["Action", "Drama"],
      Years: [2022, 1997],
    });
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]).toMatchObject({
      UserId: "user-1",
      ParentId: movies.Id,
      IncludeItemTypes: "Movie,Series",
    });
  });
  it("keeps server playlist positions and entry IDs after hiding unavailable items", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [
        { Id: "film", Name: "Film", Type: "Movie", PlaylistItemId: "first" },
        { Id: "missing", Name: "Missing", Type: "Movie", IsMissing: true },
        { Id: "film", Name: "Film", Type: "Movie", PlaylistItemId: "second" },
      ],
      TotalRecordCount: 63,
    });
    const page = await getPlaylistItems("playlist-1", 60);
    expect(page.FetchedCount).toBe(3);
    expect(page.Items).toMatchObject([
      { Id: "film", PlaylistItemId: "first", PlaylistIndex: 60 },
      { Id: "film", PlaylistItemId: "second", PlaylistIndex: 62 },
    ]);
  });
});
