import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  findItemByProviderId: async () => undefined,
}));
vi.mock("@/backend/jellyfin/people", () => ({
  getLibraryPerson: async () => undefined,
  getPersonLibrary: vi.fn(),
}));
vi.mock("@/backend/seerr/api", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/api")>()),
  getSeerrDetails: async () => ({
    id: 1,
    mediaType: "movie",
    title: "Film",
    credits: { crew: [{ id: 12, name: "Director", job: "Director" }] },
  }),
  getSeerrSettings: async () => ({ partialRequestsEnabled: true }),
  getSeerrQuota: async () => ({
    movie: { restricted: false },
    tv: { restricted: false },
  }),
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
async function settle(ms = 40) {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
}
beforeEach(() => {
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
