// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it } from "vitest";

import { TasteMedia } from "@/backend/personalisation/types";
import { exportAppPreferences } from "@/stores/appPreferences/registry";
import { useJellyfinAuth } from "@/stores/jellyfin";

import {
  getTasteProfile,
  useTasteStore,
  validateTasteMedia,
  validateTasteProfile,
} from "./index";

const session = {
  serverUrl: "/jellyfin",
  serverId: "library",
  userId: "first",
  userName: "User",
  accessToken: "private-token",
  deviceId: "web",
};
const movie: TasteMedia = {
  key: "tmdb:movie:42",
  tmdbId: 42,
  jellyfinId: "abc",
  type: "movie",
  title: "Movie",
  genres: ["Comedy"],
  studios: [],
};
describe("account taste ratings", () => {
  beforeEach(() => {
    useJellyfinAuth.setState({ session });
    useTasteStore.setState({ profiles: {} });
  });
  it("separates accounts, servers and identical movie/TV provider IDs", () => {
    useTasteStore.getState().rate(movie, "loved");
    useTasteStore
      .getState()
      .rate({ ...movie, key: "tmdb:tv:42", type: "tv" }, "hated");
    expect(Object.keys(getTasteProfile().ratings)).toEqual([
      "tmdb:movie:42",
      "tmdb:tv:42",
    ]);
    useJellyfinAuth.setState({ session: { ...session, userId: "second" } });
    expect(getTasteProfile().ratings).toEqual({});
    useJellyfinAuth.setState({
      session: { ...session, serverId: "other-library" },
    });
    expect(getTasteProfile().ratings).toEqual({});
    useJellyfinAuth.setState({ session });
    expect(getTasteProfile().ratings[movie.key].rating).toBe("loved");
  });
  it("requires account-specific opt-in and preserves taste data when disabled", () => {
    expect(getTasteProfile().preferences.dashboardEnabled).toBe(false);
    useTasteStore.getState().rate(movie, "liked");
    useTasteStore.getState().setPreferences({
      dashboardEnabled: true,
      favoriteGenres: ["Comedy"],
      completedQuiz: true,
    });
    expect(getTasteProfile().preferences.dashboardEnabled).toBe(true);
    expect(exportAppPreferences(["taste"])).toContain(
      '"dashboardEnabled": true',
    );
    useJellyfinAuth.setState({ session: { ...session, userId: "second" } });
    expect(getTasteProfile().preferences.dashboardEnabled).toBe(false);
    useJellyfinAuth.setState({ session });
    useTasteStore.getState().setPreferences({ dashboardEnabled: false });
    expect(getTasteProfile().ratings[movie.key].rating).toBe("liked");
    expect(getTasteProfile().preferences).toMatchObject({
      dashboardEnabled: false,
      favoriteGenres: ["Comedy"],
      completedQuiz: true,
    });
  });
  it("defaults legacy profiles to disabled without discarding saved ratings", () => {
    useTasteStore.getState().rate(movie, "loved");
    const legacy = validateTasteProfile({
      ratings: getTasteProfile().ratings,
      preferences: { completedQuiz: true, favoriteGenres: ["Comedy"] },
    });
    expect(legacy.preferences.dashboardEnabled).toBe(false);
    expect(legacy.preferences.completedQuiz).toBe(true);
    expect(legacy.ratings[movie.key].rating).toBe("loved");
    expect(
      validateTasteProfile({
        ...legacy,
        preferences: { ...legacy.preferences, dashboardEnabled: "true" },
      }).preferences.dashboardEnabled,
    ).toBe(false);
  });
  it("toggle clears a rating; editing through Seerr retains Jellyfin metadata", () => {
    useTasteStore.getState().rate(movie, "loved");
    useTasteStore
      .getState()
      .rate({ ...movie, jellyfinId: undefined, genres: [] }, "liked");
    expect(getTasteProfile().ratings[movie.key]).toMatchObject({
      jellyfinId: "abc",
      genres: ["Comedy"],
      rating: "liked",
    });
    useTasteStore.getState().rate(movie, "liked");
    expect(getTasteProfile().ratings).toEqual({});
  });
  it("exports only the active account and sanitises image metadata and identifiers", () => {
    useTasteStore.getState().rate(movie, "loved");
    const exported = exportAppPreferences(["taste"]);
    expect(exported).toContain('"loved"');
    expect(exported).not.toContain("private-token");
    expect(exported).not.toContain("serverUrl");
    expect(exported).not.toContain("profiles");
    expect(
      validateTasteMedia({
        ...movie,
        posterPath: "https://server/image?api_key=secret",
        imageTag: "tag&api_key=secret",
      }),
    ).toMatchObject({ posterPath: undefined, imageTag: undefined });
    expect(() =>
      validateTasteMedia({
        ...movie,
        tmdbId: undefined,
        jellyfinId: "../other",
      }),
    ).toThrow("identifier");
    expect(() =>
      validateTasteProfile({
        ratings: { item: { ...movie, ratedAt: 1, rating: "unknown" } },
      }),
    ).toThrow("rating");
  });
});
