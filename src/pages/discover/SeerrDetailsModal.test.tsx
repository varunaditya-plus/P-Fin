import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findItemByProviderId } from "@/backend/jellyfin/client";
import {
  getSeerrDetails,
  getSeerrQuota,
  getSeerrSettings,
  requestSeerrMedia,
} from "@/backend/seerr/api";
import { SeerrDetails } from "@/backend/seerr/types";

import { SeerrDetailsModal } from "./SeerrDetailsModal";

vi.mock("@/stores/jellyfin", () => ({
  useJellyfinAuth: (select: (state: object) => unknown) =>
    select({ session: { userId: "viewer", serverUrl: "/jellyfin" } }),
}));
vi.mock("@/stores/seerr", () => ({
  useSeerrConnection: (select: (state: object) => unknown) =>
    select({ connection: { userId: 1, apiUrl: "/seerr" } }),
  matchesSeerrSession: () => true,
}));
vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  findItemByProviderId: vi.fn(),
}));
vi.mock("@/backend/jellyfin/people", () => ({
  getLibraryPerson: async () => undefined,
  getPersonLibrary: vi.fn(),
}));
vi.mock("@/backend/seerr/api", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/api")>()),
  getSeerrDetails: vi.fn(),
  getSeerrSettings: vi.fn(),
  getSeerrQuota: vi.fn(),
  requestSeerrMedia: vi.fn(),
}));
vi.mock("@/backend/seerr/browse", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/browse")>()),
  getSeerrPerson: async () => ({
    id: 12,
    name: "Director",
    biography: "One\nTwo\nThree\nFour\nFive\nSix\nSeven",
  }),
  getSeerrPersonCredits: async () => ({ acting: [], directing: [] }),
}));
vi.mock("@/pages/jellyfin/JellyfinDetailsModal", () => ({
  JellyfinDetailsModal: () => null,
}));
vi.mock("./SeerrRelatedContent", () => ({
  SeerrRelatedContent: () => null,
  SeerrCollectionButton: () => null,
}));
let host: HTMLDivElement;
let root: Root;
const close = vi.fn();
const scrollIntoView = vi.fn();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
const film: SeerrDetails = {
  id: 1,
  mediaType: "movie",
  title: "Film",
  credits: { crew: [{ id: 12, name: "Director", job: "Director" }] },
};
async function settle(ms = 40) {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
}
async function renderDetails({
  focusRequest = false,
  permissions = 2,
  mediaType = "movie",
}: {
  focusRequest?: boolean;
  permissions?: number;
  mediaType?: "movie" | "tv";
} = {}) {
  await act(async () =>
    root.render(
      <HelmetProvider>
        <MemoryRouter>
          <SeerrDetailsModal
            media={{ id: 1, mediaType }}
            user={{ id: 1, permissions }}
            focusRequest={focusRequest}
            onClose={close}
            onRequested={() => undefined}
          />
        </MemoryRouter>
      </HelmetProvider>,
    ),
  );
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findItemByProviderId).mockResolvedValue(null);
  vi.mocked(getSeerrDetails).mockResolvedValue(film);
  vi.mocked(getSeerrSettings).mockResolvedValue({
    partialRequestsEnabled: true,
    enableSpecialEpisodes: false,
  });
  vi.mocked(getSeerrQuota).mockResolvedValue({
    movie: { limit: 10, used: 0, restricted: false },
    tv: { limit: 10, used: 0, restricted: false },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(120);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(140);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  close.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollIntoView)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
describe("Seerr nested person dialog", () => {
  it("lets the person dialog own focus and receive biography actions above title details", async () => {
    await act(async () =>
      root.render(
        <HelmetProvider>
          <MemoryRouter>
            <SeerrDetailsModal
              media={{ id: 1, mediaType: "movie" }}
              user={{ id: 1, permissions: 0 }}
              onClose={close}
              onRequested={() => undefined}
            />
          </MemoryRouter>
        </HelmetProvider>,
      ),
    );
    const director = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Director"))!;
    await act(async () => director.click());
    await settle();
    const person = document.querySelector(
      '[role="dialog"][aria-label="Director"]',
    )!;
    expect(person).not.toBeNull();
    expect(person.contains(document.activeElement)).toBe(true);
    const more = [...person.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Read more",
    )!;
    await act(async () => {
      more.focus();
      more.click();
    });
    expect(document.activeElement).toBe(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      more.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    await settle(600);
    expect(
      document.querySelector('[role="dialog"][aria-label="Director"]'),
    ).toBeNull();
    expect(
      document.querySelector('[role="dialog"][aria-label="Film"]'),
    ).not.toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});

describe("request-focused details", () => {
  it("focuses a movie request after loading without submitting it", async () => {
    let resolveLibrary!: (value: null) => void;
    vi.mocked(findItemByProviderId).mockReturnValue(
      new Promise((resolve) => {
        resolveLibrary = resolve;
      }),
    );
    await renderDetails({ focusRequest: true });
    expect(scrollIntoView).not.toHaveBeenCalled();
    await act(async () => resolveLibrary(null));
    await settle();
    expect(document.activeElement?.textContent).toBe("Request movie");
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(requestSeerrMedia).not.toHaveBeenCalled();
  });
  it("focuses the first requestable TV season rather than an unavailable season", async () => {
    vi.mocked(getSeerrDetails).mockResolvedValue({
      ...film,
      mediaType: "tv",
      seasons: [
        { id: 10, seasonNumber: 1, name: "Season 1", episodeCount: 8 },
        { id: 20, seasonNumber: 2, name: "Season 2", episodeCount: 8 },
      ],
      mediaInfo: { status: 4, seasons: [{ seasonNumber: 1, status: 5 }] },
    });
    await renderDetails({ focusRequest: true, mediaType: "tv" });
    expect(document.activeElement?.getAttribute("type")).toBe("checkbox");
    expect(document.activeElement?.closest("label")?.textContent).toContain(
      "Season 2",
    );
    expect((document.activeElement as HTMLInputElement).disabled).toBe(false);
    expect(requestSeerrMedia).not.toHaveBeenCalled();
  });
  it.each(["permission", "quota"])(
    "focuses status instead of a disabled request when blocked by %s",
    async (blockedBy) => {
      if (blockedBy === "quota")
        vi.mocked(getSeerrQuota).mockResolvedValue({
          movie: { limit: 1, used: 1, restricted: true },
          tv: { limit: 1, used: 1, restricted: true },
        });
      await renderDetails({
        focusRequest: true,
        permissions: blockedBy === "permission" ? 0 : 2,
      });
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Request and availability",
      );
      expect(
        document
          .querySelector('[aria-label="Request and availability"] button')
          ?.hasAttribute("disabled"),
      ).toBe(true);
      expect(requestSeerrMedia).not.toHaveBeenCalled();
    },
  );
  it("leaves ordinary More info focus and scrolling unchanged", async () => {
    await renderDetails();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Close details",
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(requestSeerrMedia).not.toHaveBeenCalled();
  });
  it("does not steal focus when a successful request refreshes details", async () => {
    let resolveRequest!: (value: {
      id: number;
      status: number;
      type: "movie";
    }) => void;
    vi.mocked(requestSeerrMedia).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    await renderDetails({ focusRequest: true });
    const request = document.activeElement as HTMLButtonElement;
    await act(async () => request.click());
    const director = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Director"))!;
    await act(async () => director.focus());
    await act(async () => resolveRequest({ id: 30, status: 1, type: "movie" }));
    await settle();
    expect(document.activeElement).toBe(director);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(requestSeerrMedia).toHaveBeenCalledOnce();
  });
});
