// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getItem, jellyfinRequest } from "@/backend/jellyfin/client";

import { getLibraryPerson, getPersonLibrary } from "./people";

vi.mock("@/backend/jellyfin/client", () => ({
  getItem: vi.fn(),
  getJellyfinSession: () => ({ userId: "viewer" }),
  jellyfinRequest: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("person library lookup", () => {
  it("uses provider identity before name and refuses ambiguous names", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [
        {
          Id: "wrong",
          Name: "Same Name",
          Type: "Person",
          ProviderIds: { Tmdb: "11" },
        },
        {
          Id: "right",
          Name: "Same Name",
          Type: "Person",
          ProviderIds: { Tmdb: "22" },
        },
      ],
    });
    await getLibraryPerson("Same Name", undefined, 22);
    expect(getItem).toHaveBeenCalledWith("right", undefined);
    vi.mocked(getItem).mockClear();
    await expect(getLibraryPerson("Same Name")).resolves.toBeUndefined();
    await expect(
      getLibraryPerson("Same Name", undefined, 33),
    ).resolves.toBeUndefined();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("loads filmography through the signed-in user and advances over missing entries", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [
        { Id: "available", Name: "Available", Type: "Movie" },
        { Id: "missing", Name: "Missing", Type: "Movie", IsMissing: true },
      ],
      TotalRecordCount: 90,
    });
    const page = await getPersonLibrary("person", 60);
    expect(page.FetchedCount).toBe(2);
    expect(page.Items).toHaveLength(1);
    expect(jellyfinRequest).toHaveBeenCalledWith(
      "Users/viewer/Items",
      { signal: undefined },
      expect.objectContaining({
        PersonIds: "person",
        StartIndex: 60,
        IncludeItemTypes: "Movie,Series",
        Recursive: true,
      }),
    );
  });
});
