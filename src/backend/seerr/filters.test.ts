// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from "vitest";

import { seerrFetch } from "./api";
import {
  defaultSeerrFilters,
  filteredSeerrPath,
  seerrDiscoveryPath,
} from "./filters";

vi.mock("./api", () => ({ seerrFetch: vi.fn() }));

describe("Seerr discovery filters", () => {
  it("maps language and genre to Seerr and avoids tiny rating samples", () => {
    const path = seerrDiscoveryPath("movie", {
      ...defaultSeerrFilters,
      language: "hi",
      genre: "28",
      sort: "vote_average.desc",
    });
    const query = new URL(path, "https://example.test").searchParams;
    expect(query.get("language")).toBe("hi");
    expect(query.get("genre")).toBe("28");
    expect(query.get("sortBy")).toBe("vote_average.desc");
    expect(query.get("voteCountGte")).toBe("100");
  });
  it("pairs streaming region with Seerr's regional provider IDs so the filter has an effect", async () => {
    vi.mocked(seerrFetch).mockResolvedValue([{ id: 8 }, { id: 9 }]);
    const path = await filteredSeerrPath("tv", {
      ...defaultSeerrFilters,
      region: "ES",
    });
    const query = new URL(path, "https://example.test").searchParams;
    expect(query.get("watchRegion")).toBe("ES");
    expect(query.get("watchProviders")).toBe("8|9");
    expect(seerrFetch).toHaveBeenCalledWith(
      "/watchproviders/tv?watchRegion=ES",
      { signal: undefined },
    );
    expect(
      new URL(
        seerrDiscoveryPath(
          "movie",
          { ...defaultSeerrFilters, region: "ES" },
          [],
        ),
        "https://example.test",
      ).searchParams.get("watchProviders"),
    ).toBe("0");
  });
});
