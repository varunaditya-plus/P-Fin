import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { randomSeerrMedia } from "@/backend/seerr/browse";

import { SeerrRandomButton } from "./SeerrRandomButton";

vi.mock("@/backend/seerr/browse", () => ({ randomSeerrMedia: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
const select = vi.fn();
const error = vi.fn();
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(randomSeerrMedia).mockResolvedValue({
    id: 42,
    mediaType: "movie",
    title: "A film",
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <SeerrRandomButton type="movie" onSelect={select} onError={error} />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
describe("immediate random discovery", () => {
  it("opens the picked title as soon as the request resolves without a countdown", async () => {
    await act(async () => host.querySelector("button")!.click());
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    expect(vi.getTimerCount()).toBe(0);
    expect(host.textContent).not.toContain("A film");
  });
  it("starts only one request during repeated clicks while loading", async () => {
    let resolve: (value: Awaited<ReturnType<typeof randomSeerrMedia>>) => void;
    vi.mocked(randomSeerrMedia).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => {
      host.querySelector("button")!.click();
      host.querySelector("button")!.click();
    });
    expect(randomSeerrMedia).toHaveBeenCalledTimes(1);
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async () => resolve!({ id: 42, mediaType: "movie" }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(host.querySelector("button")?.disabled).toBe(false);
  });
  it("aborts pending work when the media category changes", async () => {
    let resolve: (value: Awaited<ReturnType<typeof randomSeerrMedia>>) => void;
    vi.mocked(randomSeerrMedia).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => host.querySelector("button")!.click());
    const signal = vi.mocked(randomSeerrMedia).mock.calls[0][1];
    await act(async () =>
      root.render(
        <SeerrRandomButton type="tv" onSelect={select} onError={error} />,
      ),
    );
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      resolve!({ id: 42, mediaType: "movie", title: "A film" }),
    );
    await act(async () => vi.advanceTimersByTime(6000));
    expect(select).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("A film");
  });
  it("ignores a pending result after the button becomes disabled", async () => {
    let resolve: (value: Awaited<ReturnType<typeof randomSeerrMedia>>) => void;
    vi.mocked(randomSeerrMedia).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => host.querySelector("button")!.click());
    await act(async () =>
      root.render(
        <SeerrRandomButton
          type="movie"
          disabled
          onSelect={select}
          onError={error}
        />,
      ),
    );
    await act(async () => resolve!({ id: 42, mediaType: "movie" }));
    expect(select).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("A film");
  });
  it("reports a failed selection and allows retrying", async () => {
    vi.mocked(randomSeerrMedia).mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => host.querySelector("button")!.click());
    expect(error).toHaveBeenCalledWith("Unavailable");
    expect(select).not.toHaveBeenCalled();
    await act(async () => host.querySelector("button")!.click());
    expect(select).toHaveBeenCalledTimes(1);
  });
});
