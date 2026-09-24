import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getSeerrUser } from "@/backend/seerr/api";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { getTasteProfile, useTasteStore } from "@/stores/taste";

import TastePage from "./TastePage";

const quizMounted = vi.fn();
vi.mock("@/backend/personalisation/catalog", () => ({
  seerrTasteEnabled: () => true,
  tastePoster: () => undefined,
  enrichTasteMedia: vi.fn(),
  searchTasteMedia: vi.fn(),
}));
vi.mock("@/backend/seerr/api", () => ({ getSeerrUser: vi.fn() }));
vi.mock("@/pages/layouts/SubPageLayout", () => ({
  SubPageLayout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/pages/jellyfin/JellyfinDetailsModal", () => ({
  JellyfinDetailsModal: () => null,
}));
vi.mock("@/pages/discover/SeerrDetailsModal", () => ({
  SeerrDetailsModal: () => null,
}));
vi.mock("./TasteQuiz", () => ({
  TasteQuiz: () => {
    quizMounted();
    return <div>Taste quiz mounted</div>;
  },
}));
vi.mock("./usePersonalRecommendations", () => ({
  usePersonalRecommendations: () => ({ ranked: [], loading: false }),
}));

let host: HTMLDivElement;
let root: Root;
const session = {
  serverUrl: "/jellyfin",
  userId: "user",
  accessToken: "test",
  userName: "User",
  deviceId: "web",
};
const button = (label: string) =>
  [...host.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  )!;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.mocked(getSeerrUser).mockResolvedValue({ id: 1 } as never);
  useJellyfinAuth.setState({ session });
  useTasteStore.setState({ profiles: {} });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("does not mount the dashboard, quiz or their requests until explicitly enabled", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TastePage />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Enable taste profile");
  expect(host.textContent).not.toContain("Create my taste profile");
  expect(host.querySelector('[aria-label="Find watched titles"]')).toBeNull();
  expect(getSeerrUser).not.toHaveBeenCalled();
  expect(quizMounted).not.toHaveBeenCalled();

  await act(async () => button("Enable taste profile").click());
  expect(getTasteProfile().preferences.dashboardEnabled).toBe(true);
  expect(host.textContent).toContain("Create my taste profile");
  expect(getSeerrUser).toHaveBeenCalledOnce();
  expect(quizMounted).not.toHaveBeenCalled();
  await act(async () => button("Get started").click());
  expect(quizMounted).toHaveBeenCalledOnce();

  await act(async () =>
    useTasteStore.getState().setPreferences({ dashboardEnabled: false }),
  );
  expect(host.textContent).toContain("Enable taste profile");
  expect(host.textContent).not.toContain("Taste quiz mounted");
  expect(host.querySelector('[aria-label="Find watched titles"]')).toBeNull();
});

it("does not expose the enabled dashboard to another Jellyfin account", async () => {
  useTasteStore.getState().setPreferences({ dashboardEnabled: true });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TastePage />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Create my taste profile");
  vi.mocked(getSeerrUser).mockClear();
  await act(async () =>
    useJellyfinAuth.setState({ session: { ...session, userId: "other" } }),
  );
  expect(host.textContent).toContain("Enable taste profile");
  expect(getSeerrUser).not.toHaveBeenCalled();
});
