import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// Test runners are development dependencies.
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFeaturedSlideTransition } from "./useFeaturedSlideTransition";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let reducedMotion = false;

function FeaturedHarness({
  count,
  paused = false,
}: {
  count: number;
  paused?: boolean;
}) {
  const slide = useFeaturedSlideTransition(count, paused);
  return (
    <>
      <output data-testid="index">{slide.currentIndex}</output>
      <output data-testid="opacity">{slide.contentOpacity}</output>
      <button type="button" onClick={() => slide.move(1)}>
        Next
      </button>
      <button type="button" onClick={() => slide.move(-1)}>
        Previous
      </button>
    </>
  );
}

function renderFeatured(count = 3, paused = false) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<FeaturedHarness count={count} paused={paused} />));
  return container;
}

function output(name: string) {
  return container?.querySelector(`[data-testid="${name}"]`)?.textContent;
}

function click(label: string) {
  const button = Array.from(container?.querySelectorAll("button") ?? []).find(
    (candidate) => candidate.textContent === label,
  );
  act(() => button?.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  reducedMotion = false;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reducedMotion;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("featured slide transition", () => {
  it("fades the outgoing content before replacing it and revealing the next slide", () => {
    renderFeatured();
    click("Next");
    expect(output("index")).toBe("0");
    expect(output("opacity")).toBe("0");
    act(() => vi.advanceTimersByTime(150));
    expect(output("index")).toBe("1");
    expect(output("opacity")).toBe("0");
    act(() => vi.advanceTimersByTime(100));
    expect(output("opacity")).toBe("1");
  });

  it("uses the pending target for rapid navigation and clears timers on unmount", () => {
    renderFeatured();
    click("Next");
    click("Next");
    act(() => vi.advanceTimersByTime(250));
    expect(output("index")).toBe("2");
    expect(output("opacity")).toBe("1");
    act(() => root?.unmount());
    root = undefined;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not animate or autoplay when reduced motion is requested", () => {
    reducedMotion = true;
    renderFeatured();
    click("Next");
    expect(output("index")).toBe("1");
    expect(output("opacity")).toBe("1");
    act(() => vi.advanceTimersByTime(16000));
    expect(output("index")).toBe("1");
  });

  it("pauses autoplay and restarts its full interval after manual navigation", () => {
    renderFeatured();
    act(() => vi.advanceTimersByTime(6000));
    click("Next");
    act(() => vi.advanceTimersByTime(250));
    act(() => vi.advanceTimersByTime(2000));
    expect(output("index")).toBe("1");
    act(() => root?.render(<FeaturedHarness count={3} paused />));
    act(() => vi.advanceTimersByTime(16000));
    expect(output("index")).toBe("1");
  });
});
