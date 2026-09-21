// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ContentItem } from "@/backend/jellyfin/content";

import { DownloadPanel } from "./ContentDownloadModal";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({ accessToken: "test-token" }),
  jellyfinUrl: (path: string, query: Record<string, string>) =>
    `http://localhost/jellyfin/${path}?${new URLSearchParams(query)}`,
}));
vi.mock("@/components/form/Dropdown", () => ({
  Dropdown: ({ selectedItem, options, setSelectedItem }: any) => (
    <select
      value={selectedItem.id}
      onChange={(event) =>
        setSelectedItem(
          options.find((option: any) => option.id === event.target.value),
        )
      }
    >
      {options.map((option: any) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  ),
}));
const first = "11111111111111111111111111111111";
const second = "22222222222222222222222222222222";
const item: ContentItem = {
  Id: first,
  Name: "Episode",
  Type: "Episode",
  MediaSources: [
    {
      Id: first,
      Name: "HD",
      Path: "/media/episode.mp4",
      Container: "mp4",
      MediaStreams: [
        {
          Index: 1,
          Type: "Subtitle",
          Codec: "subrip",
          DisplayTitle: "English",
          Language: "eng",
        },
      ],
    },
    {
      Id: second,
      Name: "UHD",
      Path: "/media/episode-uhd.mkv",
      Container: "mkv",
      MediaStreams: [
        {
          Index: 2,
          Type: "Subtitle",
          Codec: "subrip",
          DisplayTitle: "Spanish",
          Language: "spa",
        },
      ],
    },
  ],
};
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("follows the player's selected version and refreshes download and subtitle choices together", () => {
  act(() =>
    root.render(
      <DownloadPanel
        item={item}
        policy={{ EnableContentDownloading: true }}
        sourceId={second}
        subtitleIndex={2}
      />,
    ),
  );
  expect(container.querySelector("a")?.getAttribute("download")).toBe(
    "episode-uhd.mkv",
  );
  expect(container.textContent).toContain("Spanish");
  const version = container.querySelector("select")!;
  act(() => {
    version.value = first;
    version.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector("a")?.getAttribute("download")).toBe(
    "episode.mp4",
  );
  expect(container.textContent).toContain("English");
  expect(container.textContent).not.toContain("Spanish");
});
it("shows no private links or download controls when permission is denied", () => {
  act(() =>
    root.render(
      <DownloadPanel
        item={item}
        policy={{ EnableContentDownloading: false }}
        sourceId={second}
      />,
    ),
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "unavailable for this account",
  );
});
