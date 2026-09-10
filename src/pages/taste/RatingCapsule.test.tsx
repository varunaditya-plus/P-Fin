import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enrichTasteMedia } from "@/backend/personalisation/catalog";
import { TasteMedia } from "@/backend/personalisation/types";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { getTasteProfile, useTasteStore } from "@/stores/taste";

import { RatingCapsule } from "./RatingCapsule";

vi.mock("@/backend/personalisation/catalog", () => ({
  enrichTasteMedia: vi.fn(async (media) => media),
}));
const media: TasteMedia = {
  key: "tmdb:movie:42",
  tmdbId: 42,
  title: "Film",
  type: "movie",
  genres: ["Comedy"],
  studios: [],
};
const session = {
  serverUrl: "/jellyfin",
  serverId: "server",
  userId: "user",
  userName: "User",
  accessToken: "test",
  deviceId: "web",
};
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useJellyfinAuth.setState({ session });
  useTasteStore.setState({ profiles: {} });
  vi.mocked(enrichTasteMedia).mockResolvedValue(media);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<RatingCapsule media={media} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
describe("rating capsule", () => {
  it("opens with keyboard focus, saves a rating and toggles it clear", async () => {
    await act(async () =>
      host.querySelector<HTMLButtonElement>("[aria-expanded]")!.click(),
    );
    expect(document.activeElement?.getAttribute("data-rating")).toBe("loved");
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-rating="loved"]')!.click(),
    );
    expect(getTasteProfile().ratings[media.key].rating).toBe("loved");
    expect(
      host.querySelector("[aria-expanded]")?.getAttribute("aria-expanded"),
    ).toBe("false");
    await act(async () =>
      host.querySelector<HTMLButtonElement>("[aria-expanded]")!.click(),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-rating="loved"]')!.click(),
    );
    expect(getTasteProfile().ratings).toEqual({});
  });
  it("Escape closes the capsule and does not bubble to the detail modal", async () => {
    const outside = vi.fn();
    host.parentElement!.addEventListener("keydown", outside);
    await act(async () =>
      host.querySelector<HTMLButtonElement>("[aria-expanded]")!.click(),
    );
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(outside).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(host.querySelector("[aria-expanded]"));
    host.parentElement!.removeEventListener("keydown", outside);
  });
  it("does not apply a pending metadata-assisted rating to another account", async () => {
    let resolve!: (value: TasteMedia) => void;
    vi.mocked(enrichTasteMedia).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>("[aria-expanded]")!.click(),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-rating="liked"]')!.click(),
    );
    await act(async () => {
      useJellyfinAuth.setState({ session: { ...session, userId: "other" } });
      resolve(media);
    });
    expect(getTasteProfile().ratings).toEqual({});
    expect(useTasteStore.getState().profiles).toEqual({});
  });
});
