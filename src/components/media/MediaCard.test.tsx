import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaCard } from "./MediaCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/preferences", () => ({
  usePreferencesStore: (selector?: (state: object) => unknown) => {
    const state = { enableMinimalCards: false, enableLowPerformanceMode: true };
    return selector ? selector(state) : state;
  },
}));

let root: Root;
let container: HTMLDivElement;
const details = vi.fn();

function pointer(type: string, target: Element, x = 20, y = 20) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerType: "touch", clientX: x, clientY: y });
  act(() => target.dispatchEvent(event));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();
    },
  );
  details.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <MediaCard
          media={{ id: "item", title: "Film", type: "movie", year: 2020 }}
          linkable
          onShowDetails={details}
        />
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("card menu gestures", () => {
  it("opens the menu from right-click and the ellipsis without opening details", () => {
    act(() =>
      container.querySelector("a")!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 20,
          clientY: 30,
        }),
      ),
    );
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(details).not.toHaveBeenCalled();
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Actions for Film"]')!
        .click(),
    );
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(details).not.toHaveBeenCalled();
    act(() =>
      document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click(),
    );
    expect(details).toHaveBeenCalledTimes(1);
  });

  it("opens with Shift-F10 from the keyboard-focused card", () => {
    const card = container.querySelector<HTMLElement>('[tabindex="0"]')!;
    card.focus();
    act(() =>
      card.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F10",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement?.getAttribute("role")).toBe("menuitem");
    expect(details).not.toHaveBeenCalled();
  });

  it("opens after a long press and consumes only the resulting ghost click", () => {
    const card = container.querySelector("a")!;
    pointer("pointerdown", card);
    act(() => vi.advanceTimersByTime(500));
    pointer("pointerup", card);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    act(() => card.click());
    expect(details).not.toHaveBeenCalled();
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    pointer("pointerdown", card);
    pointer("pointerup", card);
    act(() => card.click());
    expect(details).toHaveBeenCalledTimes(1);
  });

  it("does not swallow the next tap when the browser omitted the long-press ghost click", () => {
    const card = container.querySelector("a")!;
    pointer("pointerdown", card);
    act(() => vi.advanceTimersByTime(500));
    pointer("pointerup", card);
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    pointer("pointerdown", card);
    pointer("pointerup", card);
    act(() => card.click());
    expect(details).toHaveBeenCalledTimes(1);
  });

  it("cancels a long press when the user scrolls or releases before the delay", () => {
    const card = container.querySelector("a")!;
    pointer("pointerdown", card);
    pointer("pointermove", card, 45, 20);
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    pointer("pointerdown", card);
    act(() => vi.advanceTimersByTime(100));
    pointer("pointerup", card);
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
