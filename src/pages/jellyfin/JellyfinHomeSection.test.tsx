import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHomeFeedPage } from "@/backend/jellyfin/browse";
import { JellyfinItem, setFavorite } from "@/backend/jellyfin/client";
import { useJellyfinAuth } from "@/stores/jellyfin";
import {
  HomePreferences,
  defaultHomePreferences,
} from "@/stores/jellyfin/home";

import { JellyfinHomeSection } from "./JellyfinHomeSection";

vi.mock("@/backend/jellyfin/browse", () => ({ getHomeFeedPage: vi.fn() }));
vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  setFavorite: vi.fn(),
}));
vi.mock("./JellyfinMediaCarousel", () => ({
  JellyfinMediaCard: ({ item }: { item: JellyfinItem }) => (
    <button type="button" data-card>
      {item.Name}
    </button>
  ),
  JellyfinMediaCarousel: () => <div />,
}));
const items: JellyfinItem[] = Array.from({ length: 7 }, (_, i) => ({
  Id: `${i}`,
  Name: `Title ${i}`,
  Type: "Movie",
}));
let root: Root;
let host: HTMLDivElement;
let changed: ReturnType<typeof vi.fn>;
let seeAll: ReturnType<typeof vi.fn>;
async function render(
  id = "favorites",
  preferences: HomePreferences = { ...defaultHomePreferences, layout: "grid" },
) {
  await act(async () =>
    root.render(
      <JellyfinHomeSection
        id={id}
        title="Favourites"
        items={items}
        preferences={preferences}
        onSeeAll={seeAll}
        onSelect={() => {}}
        onItemChanged={changed}
        onEditingChange={() => {}}
      />,
    ),
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();

      disconnect = vi.fn();
    },
  );
  vi.mocked(getHomeFeedPage).mockResolvedValue({
    Items: items,
    TotalRecordCount: 7,
    FetchedCount: 7,
  });
  vi.mocked(setFavorite).mockResolvedValue(undefined);
  useJellyfinAuth.setState({
    session: {
      serverUrl: "/jellyfin",
      userId: "user",
      userName: "User",
      accessToken: "test",
      deviceId: "web",
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  changed = vi.fn();
  seeAll = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("home section grids", () => {
  it("reserves the last available tile for See all instead of overflowing the chosen row count", async () => {
    await render();
    expect(host.querySelectorAll("[data-card]")).toHaveLength(3);
    const more = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("See all favourites"),
    )!;
    await act(async () => more.click());
    expect(seeAll).toHaveBeenCalledOnce();
  });
  it("uses saved section rows and expands favourites edit mode with real server removal", async () => {
    await render("favorites", {
      ...defaultHomePreferences,
      layout: "grid",
      sections: { favorites: { rows: 1, editing: true } },
    });
    expect(host.querySelectorAll("[data-card]")).toHaveLength(3);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="Remove Title 0 from favourites"]',
        )!
        .click(),
    );
    expect(setFavorite).toHaveBeenCalledWith("0", false);
    expect(changed).toHaveBeenCalledOnce();
  });
  it("does not expose removal for library or Next Up query results even if imported edit state says true", async () => {
    await render("next-up", {
      ...defaultHomePreferences,
      layout: "grid",
      sections: { "next-up": { editing: true } },
    });
    expect(host.querySelector('[aria-label^="Remove"]')).toBeNull();
    expect(host.textContent).not.toContain("Edit favourites");
    expect(setFavorite).not.toHaveBeenCalled();
  });
});
