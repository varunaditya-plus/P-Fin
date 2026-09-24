import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  applyLetterboxd,
  previewLetterboxd,
} from "@/backend/integrations/letterboxd";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { LetterboxdSettings } from "./LetterboxdSettings";

vi.mock("@/backend/integrations/letterboxd", async (original) => ({
  ...(await original<typeof import("@/backend/integrations/letterboxd")>()),
  previewLetterboxd: vi.fn(),
  applyLetterboxd: vi.fn(),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  useJellyfinAuth.setState({
    session: {
      serverUrl: "/jellyfin",
      serverAddress: "https://jellyfin.example",
      userId: "user",
      accessToken: "test",
      userName: "User",
      deviceId: "web",
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LetterboxdSettings />
      </MemoryRouter>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("shows matching progress and cancels without applying server changes", async () => {
  let complete!: () => void;
  vi.mocked(previewLetterboxd).mockImplementation(async (_titles, options) => {
    options.progress?.([{ id: 0, title: "Film", year: 2020, candidates: [] }]);
    await new Promise<void>((resolve) => {
      complete = resolve;
    });
    return [];
  });
  const file = new File([""], "watched.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: async () => "Name,Year\nFilm,2020\nAnother,2021",
  });
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Preview matches")!
      .click(),
  );
  expect(
    host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
  ).toBe("1");
  expect(
    host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuemax"),
  ).toBe("2");
  const signal = vi.mocked(previewLetterboxd).mock.calls[0][1].signal;
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Stop")!
      .click(),
  );
  expect(signal?.aborted).toBe(true);
  await act(async () => complete());
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "Stopped",
  );
  expect(applyLetterboxd).not.toHaveBeenCalled();
});

it("previews and applies watched films without a watchlist destination", async () => {
  const row = {
    id: 0,
    title: "Film",
    year: 2020,
    candidates: [{ title: "Film", year: 2020, jellyfinId: "film" }],
    selected: { title: "Film", year: 2020, jellyfinId: "film" },
  };
  vi.mocked(previewLetterboxd).mockImplementation(async (_titles, options) => {
    options.progress([row]);
    return [row];
  });
  vi.mocked(applyLetterboxd).mockResolvedValue({
    added: 1,
    skipped: 0,
    failures: [],
  });
  const file = new File([""], "watched.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", {
    value: async () => "Name,Year\nFilm,2020",
  });
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Preview matches")!
      .click(),
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Mark 1 matched films watched")!
      .click(),
  );
  expect(applyLetterboxd).toHaveBeenCalledWith(
    [row],
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(host.textContent).toContain("1 marked watched");
  expect(host.textContent?.toLowerCase()).not.toContain("watchlist");
  expect(host.textContent).not.toContain("Import as");
});
