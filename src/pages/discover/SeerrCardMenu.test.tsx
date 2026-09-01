import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findItemByProviderId } from "@/backend/jellyfin/client";
import { SeerrMedia } from "@/backend/seerr/types";

import { SeerrCardMenu } from "./SeerrCardMenu";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/backend/jellyfin/client", () => ({ findItemByProviderId: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
const details = vi.fn();
const close = vi.fn();
const fetch = vi.fn();

async function render(media: SeerrMedia) {
  await act(async () =>
    root.render(
      <SeerrCardMenu media={media} onShowDetails={details} close={close} />,
    ),
  );
}
async function choose(label: string) {
  const action = [
    ...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  ].find((button) => button.textContent?.includes(label));
  expect(action).toBeDefined();
  await act(async () => action!.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetch);
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Seerr card actions", () => {
  it("opens request options in the details modal without sending a request", async () => {
    const media: SeerrMedia = { id: 123, title: "Film", mediaType: "movie" };
    await render(media);
    await choose("Request content");
    expect(details).toHaveBeenCalledWith(media);
    expect(close).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(findItemByProviderId).not.toHaveBeenCalled();
  });

  it("resolves a user-accessible Jellyfin ID before opening available content", async () => {
    vi.mocked(findItemByProviderId).mockResolvedValue({
      Id: "jf-series",
      Name: "Series",
      Type: "Series",
    });
    await render({
      id: 456,
      name: "Series",
      mediaType: "tv",
      mediaInfo: { status: 5 },
    });
    await choose("Open in library");
    expect(findItemByProviderId).toHaveBeenCalledWith(456, "tv");
    expect(navigate).toHaveBeenCalledWith("/?item=jf-series");
  });
});
