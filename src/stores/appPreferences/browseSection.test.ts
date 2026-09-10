// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it } from "vitest";

import { defaultLibraryBrowse } from "@/stores/jellyfin/browse";

import { validateBrowseProfile } from "./browseSection";

it("validates scoped browse sorting, strips unknown fields, and rejects invalid filter values", () => {
  expect(
    validateBrowseProfile({
      libraries: {
        movies: {
          ...defaultLibraryBrowse,
          sortBy: "SeriesLength",
          extra: true,
        },
      },
      sectionSort: { resume: "year" },
      secret: "discard",
    }),
  ).toEqual({
    libraries: { movies: { ...defaultLibraryBrowse, sortBy: "SeriesLength" } },
    sectionSort: { resume: "year" },
  });
  expect(() =>
    validateBrowseProfile({
      libraries: { movies: { ...defaultLibraryBrowse, status: "AllUsers" } },
      sectionSort: {},
    }),
  ).toThrow("filters");
});
