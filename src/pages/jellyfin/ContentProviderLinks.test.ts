// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import {
  getContentProviderLinks,
  isContentProviderUrl,
} from "./ContentProviderLinks";

describe("Jellyfin provider links", () => {
  it("uses official title URLs for the item's IMDb and TMDB IDs", () => {
    expect(
      getContentProviderLinks({
        Type: "Movie",
        ProviderIds: { Imdb: "tt1234567", Tmdb: "125" },
      }),
    ).toEqual([
      { provider: "imdb", url: "https://www.imdb.com/title/tt1234567" },
      { provider: "tmdb", url: "https://www.themoviedb.org/movie/125" },
    ]);
    expect(
      getContentProviderLinks({ Type: "Series", ProviderIds: { Tmdb: "93" } }),
    ).toEqual([{ provider: "tmdb", url: "https://www.themoviedb.org/tv/93" }]);
  });

  it("falls back to verified official external URLs without trusting arbitrary hosts", () => {
    expect(
      getContentProviderLinks({
        Type: "Episode",
        ProviderIds: { Imdb: "tt123/evil", Tmdb: "123" },
        ExternalUrls: [
          { Name: "IMDb", Url: "https://www.imdb.com/title/tt7654321/" },
          { Name: "Fake", Url: "https://www.imdb.com.evil.test/title/tt1" },
          { Name: "TMDB", Url: "https://www.themoviedb.org/tv/89" },
        ],
      }),
    ).toEqual([
      { provider: "imdb", url: "https://www.imdb.com/title/tt7654321" },
      { provider: "tmdb", url: "https://www.themoviedb.org/tv/89" },
    ]);
    expect(isContentProviderUrl("data:text/plain,hello")).toBe(false);
    expect(
      isContentProviderUrl("https://www.imdb.com.evil.test/title/tt1234567"),
    ).toBe(false);
    expect(isContentProviderUrl("https://www.imdb.com/title/tt1234567")).toBe(
      true,
    );
  });
});
