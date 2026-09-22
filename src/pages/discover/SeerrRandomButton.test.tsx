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
describe("random discovery countdown", () => {
  it("opens the picked title's details only after five seconds", async () => {
    await act(async () => host.querySelector("button")!.click());
    expect(host.textContent).toContain("A film");
    for (let second = 0; second < 4; second += 1)
      await act(async () => vi.advanceTimersByTime(1000));
    expect(select).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });
  it("cancels a pick with the same button", async () => {
    await act(async () => host.querySelector("button")!.click());
    await act(async () => host.querySelector("button")!.click());
    await act(async () => vi.advanceTimersByTime(6000));
    expect(select).not.toHaveBeenCalled();
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Random movie",
    );
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
  it("cancels an active countdown while replacement discovery filters are resolving", async () => {
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
    await act(async () => vi.advanceTimersByTime(6000));
    expect(select).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("A film");
  });
});
