// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DetailsModalFrame, useRetainedModalValue } from "./DetailsModalFrame";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let finishLeave: () => void;

function PresenceHarness({ value }: { value?: string }) {
  const presence = useRetainedModalValue(value);
  finishLeave = presence.afterLeave;
  return presence.value ? (
    <div data-open={presence.open}>{presence.value}</div>
  ) : null;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("details modal presence", () => {
  it("retains content while closing and only unmounts after the exit transition", () => {
    act(() => root.render(<PresenceHarness value="film" />));
    expect(container.firstElementChild?.getAttribute("data-open")).toBe("true");
    act(() => root.render(<PresenceHarness />));
    expect(container.textContent).toBe("film");
    expect(container.firstElementChild?.getAttribute("data-open")).toBe(
      "false",
    );
    act(() => finishLeave());
    expect(container.childElementCount).toBe(0);
  });
  it("keeps a reopened modal when an earlier exit completes late", () => {
    act(() => root.render(<PresenceHarness value="first" />));
    act(() => root.render(<PresenceHarness />));
    const oldLeave = finishLeave;
    act(() => root.render(<PresenceHarness value="second" />));
    act(() => oldLeave());
    expect(container.textContent).toBe("second");
    expect(container.firstElementChild?.getAttribute("data-open")).toBe("true");
  });
  it("does not mount a hidden modal before it has content", () => {
    act(() => root.render(<PresenceHarness />));
    expect(container.childElementCount).toBe(0);
    act(() => root.render(<PresenceHarness value="film" />));
    expect(container.textContent).toBe("film");
  });
});

describe("details dialog lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();

        unobserve = vi.fn();

        disconnect = vi.fn();
      },
    );
  });
  const settle = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
  };
  it("restores focus and releases the scroll lock after closing", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const close = vi.fn();
    const render = (open: boolean) =>
      root.render(
        <HelmetProvider>
          <DetailsModalFrame
            open={open}
            onClose={close}
            afterLeave={() => {}}
            label="Film"
          >
            <button type="button">Inside</button>
          </DetailsModalFrame>
        </HelmetProvider>,
      );
    await act(async () => render(true));
    await settle();
    expect(
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    ).toBe(true);
    expect(document.documentElement.hasAttribute("data-no-scroll")).toBe(true);
    await act(async () => render(false));
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.documentElement.hasAttribute("data-no-scroll")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
  it("returns from library details without closing discovery or leaving its focus trap", async () => {
    const closeDiscovery = vi.fn();
    function NestedDetails() {
      const [library, setLibrary] = useState(false);
      return (
        <HelmetProvider>
          <DetailsModalFrame
            open={!library}
            onClose={closeDiscovery}
            afterLeave={() => {}}
            label="Discovery"
          >
            <button type="button" onClick={() => setLibrary(true)}>
              Open library
            </button>
          </DetailsModalFrame>
          <DetailsModalFrame
            open={library}
            onClose={() => setLibrary(false)}
            afterLeave={() => {}}
            label="Library"
          >
            <button type="button" onClick={() => setLibrary(false)}>
              Close library
            </button>
          </DetailsModalFrame>
        </HelmetProvider>
      );
    }
    await act(async () => root.render(<NestedDetails />));
    await settle();
    await act(async () =>
      (
        document.querySelector('[role="dialog"] button') as HTMLButtonElement
      ).click(),
    );
    await settle();
    expect(
      document.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
    ).toBe("Library");
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await settle();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("Discovery");
    expect(dialog?.contains(document.activeElement)).toBe(true);
    expect(document.documentElement.hasAttribute("data-no-scroll")).toBe(true);
    expect(closeDiscovery).not.toHaveBeenCalled();
  });
});
