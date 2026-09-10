import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enrichTasteMedia,
  getSeerrTastePage,
  getTasteLibrary,
  seerrTasteEnabled,
} from "@/backend/personalisation/catalog";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { getTasteProfile, useTasteStore } from "@/stores/taste";

import { TasteQuiz } from "./TasteQuiz";

vi.mock("@/backend/personalisation/catalog", () => ({
  getTasteLibrary: vi.fn(),
  getSeerrTastePage: vi.fn(),
  seerrTasteEnabled: vi.fn(),
  tastePoster: () => undefined,
  enrichTasteMedia: vi.fn(async (media) => media),
}));
let host: HTMLDivElement;
let root: Root;
const finish = vi.fn();
function button(label: string) {
  return [...host.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  )!;
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  useJellyfinAuth.setState({
    session: {
      serverUrl: "/jellyfin",
      userId: "user",
      accessToken: "test",
      userName: "User",
      deviceId: "web",
    },
  });
  useTasteStore.setState({ profiles: {} });
  vi.mocked(seerrTasteEnabled).mockReturnValue(true);
  vi.mocked(getTasteLibrary).mockResolvedValue([]);
  vi.mocked(getSeerrTastePage).mockImplementation(async (type, page) => ({
    totalPages: 3,
    items: Array.from({ length: 4 }, (_, index) => ({
      item: { id: page * 10 + index, mediaType: type },
      media: {
        key: `tmdb:${type}:${page * 10 + index}`,
        type,
        title: `${type}-${page}-${index}`,
        tmdbId: page * 10 + index,
        genres: ["Comedy"],
        studios: [],
      },
    })),
  }));
  vi.mocked(enrichTasteMedia).mockImplementation(async (media) => media);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TasteQuiz onFinish={finish} />
      </MemoryRouter>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
describe("taste quiz", () => {
  it("keeps library questions usable when optional Seerr discovery fails", async () => {
    vi.mocked(getTasteLibrary).mockResolvedValue([
      {
        item: { Id: "local", Type: "Movie", Name: "Library film" },
        media: {
          key: "jellyfin:movie:local",
          jellyfinId: "local",
          type: "movie",
          title: "Library film",
          genres: ["Comedy"],
          studios: [],
        },
      },
    ]);
    vi.mocked(getSeerrTastePage).mockRejectedValue(new Error("Offline"));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <TasteQuiz key="offline" onFinish={finish} />
        </MemoryRouter>,
      ),
    );
    expect(host.querySelector("h3")?.textContent).toBe("Library film");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "still rate",
    );
    await act(async () => button("Loved").click());
    expect(getTasteProfile().ratings["jellyfin:movie:local"].rating).toBe(
      "loved",
    );
  });
  it("does not fetch the hidden TV stage and refills without repeating skipped titles", async () => {
    expect(
      vi
        .mocked(getSeerrTastePage)
        .mock.calls.every(([type]) => type === "movie"),
    ).toBe(true);
    const seen = new Set<string>();
    for (let index = 0; index < 6; index += 1) {
      const title = host.querySelector("h3")!.textContent!;
      expect(seen.has(title)).toBe(false);
      seen.add(title);
      await act(async () => button("Not watched").click());
    }
    expect(
      vi.mocked(getSeerrTastePage).mock.calls.some(([, page]) => page === 2),
    ).toBe(true);
    expect(getTasteProfile().ratings).toEqual({});
  });
  it("can skip movies, rate a TV title and finish with saved preferences", async () => {
    await act(async () => button("Continue to TV shows").click());
    expect(host.querySelector("h3")?.textContent).toContain("tv-");
    await act(async () => button("Loved").click());
    expect(Object.values(getTasteProfile().ratings)[0]).toMatchObject({
      type: "tv",
      rating: "loved",
    });
    await act(async () => button("Finish setup").click());
    expect(getTasteProfile().preferences.completedQuiz).toBe(true);
    expect(finish).toHaveBeenCalledOnce();
  });
});
