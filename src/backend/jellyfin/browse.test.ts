// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { JellyfinItem } from "@/backend/jellyfin/client";

import { normalizeLibrarySearch, uniqueLibraryItems } from "./browse";

const film = (Id: string, Name: string): JellyfinItem => ({
  Id,
  Name,
  Type: "Movie",
});

describe("library helpers", () => {
  it("normalises title punctuation and accents", () => {
    expect(normalizeLibrarySearch("  Amélie: Life & Love  ")).toBe(
      "amelie life and love",
    );
  });
  it("deduplicates page overlap and hides virtual entries", () => {
    expect(
      uniqueLibraryItems([
        film("one", "One"),
        film("one", "One"),
        { ...film("virtual", "Virtual"), IsVirtualItem: true },
      ]),
    ).toHaveLength(1);
  });
});
