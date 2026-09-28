// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import {
  addContentToContainer,
  getContentPolicy,
  getPlaylistEditPermission,
} from "@/backend/jellyfin/content";

import { addUniqueContainerItems } from "./collections";

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
  it("checks every page before adding and deduplicates repeated IDs", async () => {
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
    await expect(
      addUniqueContainerItems("BoxSet", "collection", ["item"]),
    ).rejects.toThrow("cannot manage");
    expect(jellyfinRequest).not.toHaveBeenCalled();
    vi.mocked(getContentPolicy).mockImplementation(async () => {
      userId = "second";
      return { EnableCollectionManagement: true };
    });
    await expect(
      addUniqueContainerItems("BoxSet", "collection", ["item"]),
    ).rejects.toThrow("account changed");
    expect(jellyfinRequest).not.toHaveBeenCalled();
  });
});
