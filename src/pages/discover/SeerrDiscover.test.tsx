import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeerrDiscover } from "./SeerrDiscover";

vi.mock("@/stores/jellyfin", () => ({
  useJellyfinAuth: (select: (state: object) => unknown) =>
    select({ session: { userId: "viewer", serverUrl: "/jellyfin" } }),
}));
vi.mock("@/stores/seerr", () => ({
  useSeerrConnection: (select: (state: object) => unknown) =>
    select({ connection: { userId: 1, apiUrl: "/seerr" } }),
  matchesSeerrSession: () => true,
}));
const recommendations = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/pages/taste/usePersonalRecommendations", () => ({
  usePersonalRecommendations: (_source: string, type: string) => ({
    rows: [],
    ranked: recommendations.enabled
      ? [
          {
            candidate: {
              item: {
                id: 42,
                mediaType: type,
                title:
                  type === "movie" ? "Recommended film" : "Recommended show",
              },
            },
          },
        ]
      : [],
    hero: [],
    hasSignals: recommendations.enabled,
    loading: false,
    error: "",
  }),
}));
vi.mock("@/pages/layouts/SubPageLayout", () => ({
  SubPageLayout: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/pages/parts/util/PageTitle", () => ({ PageTitle: () => null }));
vi.mock("./SeerrDetailsModal", () => ({ SeerrDetailsModal: () => null }));
vi.mock("./SeerrCardMenu", () => ({ SeerrCardMenu: () => null }));
vi.mock("./SeerrSetup", () => ({ SeerrSetup: () => null }));
vi.mock("./components/CarouselNavButtons", () => ({
  CarouselNavButtons: () => null,
}));
vi.mock("./components/ScrollToTopButton", () => ({
  ScrollToTopButton: () => null,
}));
vi.mock("@/components/media/MediaCard", () => ({
  MediaCard: ({ media }: { media: { title: string } }) => (
    <div>{media.title}</div>
  ),
  MediaCardSkeleton: () => <div />,
}));
vi.mock("@/components/form/SearchBar", () => ({
  SearchBarInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Discovery search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock("@/backend/seerr/api", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/api")>()),
  getSeerrUser: async () => ({ id: 1, permissions: 0 }),
  seerrImage: () => undefined,
  seerrToMediaItem: (media: object) => media,
}));
vi.mock("@/backend/seerr/browse", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/browse")>()),
  cachedSeerrPage: () => undefined,
  getCachedSeerrPage: async () => ({
    page: 1,
    totalPages: 2,
    totalResults: 2,
    results: [{ id: 1, mediaType: "movie", title: "Film" }],
  }),
}));

let host: HTMLDivElement;
let root: Root;
function Harness() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        History forward
      </button>
      <button type="button" onClick={() => navigate("/discover?q=second")}>
        Second query
      </button>
      <output data-location>
        {location.pathname}
        {location.search}
      </output>
      <SeerrDiscover />
    </>
  );
}
async function render(url: string) {
  await act(async () =>
    root.render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[url]}>
          <Harness />
        </MemoryRouter>
      </HelmetProvider>,
    ),
  );
}
async function click(label: string) {
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === label)!
      .click(),
  );
}
async function settleSearch() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 380);
    });
  });
}
beforeEach(() => {
  recommendations.enabled = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect = vi.fn();

      unobserve = vi.fn();
    },
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Discover URL navigation", () => {
  it("shows For You as one category-specific row alongside the normal feeds", async () => {
    recommendations.enabled = true;
    await render("/discover");
    expect(host.querySelectorAll('section[aria-label="For You"]')).toHaveLength(
      1,
    );
    expect(
      [...host.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === "For You",
      ),
    ).toBe(false);
    expect(
      host.querySelector('section[aria-label="For You"]')?.textContent,
    ).toContain("Recommended film");
    expect(
      host.querySelector('section[aria-label="Popular movies"]'),
    ).not.toBeNull();
    expect(host.querySelector('section[aria-label="Trending"]')).not.toBeNull();
    expect(
      host.querySelector('section[aria-label="Popular Picks"]'),
    ).toBeNull();
    await click("TV shows");
    expect(
      host.querySelector('section[aria-label="For You"]')?.textContent,
    ).toContain("Recommended show");
    expect(
      host.querySelector('section[aria-label="Popular TV shows"]'),
    ).not.toBeNull();
  });
  it("keeps ordinary browsing available without personalisation signals", async () => {
    await render("/discover");
    expect(host.querySelector('section[aria-label="For You"]')).toBeNull();
    expect(host.querySelector('section[aria-label="Trending"]')).not.toBeNull();
    expect(host.querySelector('a[href="/taste"]')).toBeNull();
  });
  it("returns from More through history without inserting a duplicate browse entry", async () => {
    await render("/discover");
    await click("More");
    await settleSearch();
    expect(host.querySelector("[data-location]")?.textContent).toContain(
      "feed=",
    );
    await click("Back");
    expect(host.querySelector("[data-location]")?.textContent).toBe(
      "/discover",
    );
    await click("History forward");
    expect(host.querySelector("[data-location]")?.textContent).toContain(
      "feed=",
    );
  });
  it("restores the search input when navigating backward and forward", async () => {
    await render("/discover?q=first");
    await click("Second query");
    await settleSearch();
    expect(host.querySelector("input")?.value).toBe("second");
    await click("History back");
    await settleSearch();
    expect(host.querySelector("input")?.value).toBe("first");
    await click("History forward");
    expect(host.querySelector("input")?.value).toBe("second");
  });
  it("returns from an old filtered grid to normal browsing without hidden filters", async () => {
    await render(
      "/discover?genre=28&view=Action&feed=%2Fdiscover%2Fmovies%3Fgenre%3D28",
    );
    await click("Back");
    expect(host.querySelector("[data-location]")?.textContent).toBe(
      "/discover",
    );
    expect(host.querySelector('[aria-label="Discovery filters"]')).toBeNull();
    expect(
      host.querySelector('section[aria-label="Popular movies"]'),
    ).not.toBeNull();
  });
  it("discards legacy filters while preserving the selected category and search", async () => {
    await render(
      "/discover?kind=tv&lang=en&region=US&genre=28&sort=vote_average.desc&q=first",
    );
    expect(host.querySelector("[data-location]")?.textContent).toBe(
      "/discover?kind=tv&q=first",
    );
    expect(host.querySelector("input")?.value).toBe("first");
    expect(host.querySelector('[aria-label="Discovery filters"]')).toBeNull();
  });
});
