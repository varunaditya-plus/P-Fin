// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";

import {
  ContentItem,
  applyContentIdentity,
  contentPermissions,
  createContentContainer,
  getContentContainers,
  getPlaylistConfiguration,
  getPlaylistEditPermission,
  movePlaylistEntry,
  removeContentFromContainer,
  safeExternalUrl,
  searchContentIdentity,
  updateContentMetadata,
  updatePlaylistDetails,
  uploadContentSubtitle,
} from "./content";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({ userId: "user" }),
  jellyfinRequest: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(jellyfinRequest).mockReset();
});
const movie: ContentItem = {
  Id: "movie",
  Name: "Film",
  Type: "Movie",
  MediaType: "Video",
};

describe("Jellyfin content management", () => {
  it("defaults administrative controls to denied and honours item-specific deletion rights", () => {
    expect(contentPermissions(movie, {})).toEqual({
      edit: false,
      subtitles: false,
      delete: false,
      download: false,
      collections: false,
    });
    expect(
      contentPermissions(
        { ...movie, CanDelete: false },
        { IsAdministrator: true },
      ),
    ).toMatchObject({
      edit: true,
      subtitles: true,
      delete: false,
      collections: true,
    });
    expect(contentPermissions({ ...movie, CanDelete: true }, {})).toMatchObject(
      { delete: true },
    );
    expect(
      contentPermissions(
        { ...movie, CanDownload: false },
        { EnableContentDownloading: true },
      ),
    ).toMatchObject({ download: false });
  });
  it("does not offer subtitle edits on a series or music collection", () => {
    expect(
      contentPermissions(
        { ...movie, Type: "Series", MediaType: undefined },
        { EnableSubtitleManagement: true },
      ).subtitles,
    ).toBe(false);
    expect(
      contentPermissions(movie, { EnableSubtitleManagement: true }).subtitles,
    ).toBe(true);
  });
  it("preserves metadata outside the editor and pins saves to the original item", async () => {
    await updateContentMetadata(
      {
        ...movie,
        ProviderIds: { Tmdb: "7" },
        LockedFields: ["Genres"],
        LockData: true,
        People: [{ Id: "person", Name: "Writer", Type: "Writer" }],
      },
      { Id: "different", Name: "Correct title" },
    );
    const [path, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(path).toBe("Items/movie");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      Id: "movie",
      Name: "Correct title",
      ProviderIds: { Tmdb: "7" },
      LockedFields: ["Genres"],
      LockData: true,
      People: [{ Name: "Writer" }],
    });
  });
  it("encodes uploaded subtitle bytes with language and accessibility flags", async () => {
    await uploadContentSubtitle(
      "alternate-version",
      new File(["1\n00:00:01,000 --> 00:00:02,000\nHello"], "english.srt"),
      "eng",
      true,
      true,
    );
    const [path, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(path).toBe("Videos/alternate-version/Subtitles");
    expect(body).toMatchObject({
      Language: "eng",
      Format: "srt",
      IsForced: true,
      IsHearingImpaired: true,
    });
    expect(atob(body.Data)).toContain("Hello");
    await expect(
      uploadContentSubtitle(
        "movie",
        new File(["wrong"], "bad.exe"),
        "eng",
        false,
        false,
      ),
    ).rejects.toThrow("subtitle file");
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
  it("creates private playlists and uses collection query parameters", async () => {
    await createContentContainer("Playlist", " My list ", "movie");
    expect(
      JSON.parse(vi.mocked(jellyfinRequest).mock.calls[0][1]!.body as string),
    ).toMatchObject({
      Name: "My list",
      Ids: ["movie"],
      UserId: "user",
      IsPublic: false,
    });
    await createContentContainer("BoxSet", "Collection", "movie");
    expect(vi.mocked(jellyfinRequest).mock.calls[1]).toEqual([
      "Collections",
      { method: "POST" },
      { name: "Collection", ids: "movie", isLocked: false },
    ]);
  });
  it("does not offer read-only playlists as add destinations", async () => {
    vi.mocked(jellyfinRequest).mockImplementation(async (path) => {
      if (path === "Items")
        return {
          Items: [
            { Id: "mine", Name: "Mine", Type: "Playlist" },
            { Id: "shared", Name: "Read only", Type: "Playlist" },
          ],
          TotalRecordCount: 2,
        };
      return { CanEdit: path.includes("mine") };
    });
    expect(
      (await getContentContainers("Playlist")).map((item) => item.Id),
    ).toEqual(["mine"]);
  });
  it("reads playlist visibility and the current user's edit permission", async () => {
    await getPlaylistConfiguration("playlist");
    await getPlaylistEditPermission("playlist");
    expect(vi.mocked(jellyfinRequest).mock.calls).toEqual([
      ["Playlists/playlist", { signal: undefined }],
      ["Playlists/playlist/Users/user", { signal: undefined }],
    ]);
  });
  it("updates only named playlist settings, leaving users and items unchanged", async () => {
    await updatePlaylistDetails("playlist", {
      Name: " Revised ",
      IsPublic: true,
    });
    const [path, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(path).toBe("Playlists/playlist");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      Name: "Revised",
      IsPublic: true,
    });
    await updatePlaylistDetails("playlist", { IsPublic: false });
    expect(
      JSON.parse(vi.mocked(jellyfinRequest).mock.calls[1][1]?.body as string),
    ).toEqual({ IsPublic: false });
    expect(() => updatePlaylistDetails("playlist", { Name: "  " })).toThrow(
      "playlist name",
    );
  });
  it("removes collection media IDs and individual playlist entry IDs", async () => {
    await removeContentFromContainer("BoxSet", "collection", "movie");
    await removeContentFromContainer("Playlist", "playlist", "entry-2");
    expect(vi.mocked(jellyfinRequest).mock.calls).toEqual([
      ["Collections/collection/Items", { method: "DELETE" }, { ids: "movie" }],
      [
        "Playlists/playlist/Items",
        { method: "DELETE" },
        { entryIds: "entry-2" },
      ],
    ]);
    expect(() =>
      removeContentFromContainer("Playlist", "playlist", ""),
    ).toThrow("entry ID");
  });
  it("moves a playlist entry to an absolute visible index", async () => {
    await movePlaylistEntry("playlist", "entry-2", 3);
    expect(vi.mocked(jellyfinRequest).mock.calls[0]).toEqual([
      "Playlists/playlist/Items/entry-2/Move/3",
      { method: "POST" },
    ]);
    expect(() => movePlaylistEntry("playlist", "entry-2", -1)).toThrow(
      "cannot be moved",
    );
  });
  it("searches identification without changing the item and only applies an explicitly chosen result", async () => {
    await searchContentIdentity(movie, "Correct film", 2009, { Tmdb: "123" });
    const [path, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(path).toBe("Items/RemoteSearch/Movie");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      ItemId: "movie",
      SearchInfo: {
        Name: "Correct film",
        Year: 2009,
        ProviderIds: { Tmdb: "123" },
      },
    });
    await applyContentIdentity(
      movie.Id,
      { Name: "Correct film", ProviderIds: { Tmdb: "123" } },
      false,
    );
    expect(vi.mocked(jellyfinRequest).mock.calls[1][0]).toBe(
      "Items/RemoteSearch/Apply/movie",
    );
    expect(vi.mocked(jellyfinRequest).mock.calls[1][2]).toEqual({
      replaceAllImages: false,
    });
  });
  it("rejects executable and relative URLs from metadata", () => {
    // eslint-disable-next-line no-script-url
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("/local/path")).toBeUndefined();
    expect(safeExternalUrl("https://example.com/film")).toBe(
      "https://example.com/film",
    );
  });
});
