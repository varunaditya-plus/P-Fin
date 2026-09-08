// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import {
  addContentToContainer,
  getContentPolicy,
  getPlaylistEditPermission,
} from "@/backend/jellyfin/content";

import {
  addUniqueContainerItems,
  createEmptyContainer,
  parseLibraryDrop,
} from "./collections";

let userId = "first";
vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({
    userId,
    serverUrl: "server",
    accessToken: userId,
  }),
  jellyfinRequest: vi.fn(),
}));
vi.mock("@/backend/jellyfin/content", () => ({
  addContentToContainer: vi.fn(),
  getContentPolicy: vi.fn(),
  getPlaylistEditPermission: vi.fn(),
  removeContentFromContainer: vi.fn(),
}));

beforeEach(() => {
  userId = "first";
  vi.resetAllMocks();
  vi.mocked(getContentPolicy).mockResolvedValue({
    EnableCollectionManagement: true,
  });
  vi.mocked(getPlaylistEditPermission).mockResolvedValue({ CanEdit: true });
});

describe("collection controls", () => {
  it("checks every page before adding and deduplicates repeated dropped IDs", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Items: Array.from({ length: 200 }, (_, index) => ({
          Id: `first-${index}`,
        })),
        TotalRecordCount: 201,
      })
      .mockResolvedValueOnce({
        Items: [{ Id: "already-present" }],
        TotalRecordCount: 201,
      });
    expect(
      await addUniqueContainerItems("Playlist", "playlist", [
        "already-present",
        "new",
        "new",
        "playlist",
      ]),
    ).toBe(1);
    expect(addContentToContainer).toHaveBeenCalledTimes(1);
    expect(addContentToContainer).toHaveBeenCalledWith(
      "Playlist",
      "playlist",
      "new",
    );
    expect(vi.mocked(jellyfinRequest).mock.calls[1][2]?.StartIndex).toBe(200);
  });
  it("does not mutate read-only containers or a newly signed-in account", async () => {
    vi.mocked(getContentPolicy).mockResolvedValue({});
    await expect(createEmptyContainer("BoxSet", "Name")).rejects.toThrow(
      "cannot manage",
    );
    expect(jellyfinRequest).not.toHaveBeenCalled();
    vi.mocked(getContentPolicy).mockImplementation(async () => {
      userId = "second";
      return { EnableCollectionManagement: true };
    });
    await expect(createEmptyContainer("BoxSet", "Name")).rejects.toThrow(
      "account changed",
    );
    expect(jellyfinRequest).not.toHaveBeenCalled();
  });
  it("creates a private empty playlist without a bogus media ID", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({ Id: "playlist" });
    await createEmptyContainer("Playlist", "Weekend");
    const [path, options] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(path).toBe("Playlists");
    expect(JSON.parse(options?.body as string)).toEqual({
      Name: "Weekend",
      Ids: [],
      UserId: "first",
      MediaType: "Video",
      IsPublic: false,
    });
  });
  it("accepts only bounded library IDs from drag data", () => {
    const id = "1".repeat(32);
    expect(
      parseLibraryDrop(JSON.stringify([id, id, "https://other.test", 5])),
    ).toEqual([id]);
    expect(parseLibraryDrop("not json")).toEqual([]);
    expect(
      parseLibraryDrop(JSON.stringify(Array.from({ length: 201 }, () => id))),
    ).toEqual([]);
  });
});
