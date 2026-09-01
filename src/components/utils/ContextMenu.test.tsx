import { act, useRef, useState } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextMenu, ContextMenuItem } from "./ContextMenu";

let root: Root;
let container: HTMLDivElement;
let resize: (() => void) | undefined;
let height = 100;

function Harness() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div data-details-modal-panel>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Actions
      </button>
      {open && anchor.current ? (
        <ContextMenu
          x={1010}
          y={760}
          anchor={anchor.current}
          label="Title actions"
          onClose={() => setOpen(false)}
        >
          <ContextMenuItem onClick={() => undefined}>First</ContextMenuItem>
          <ContextMenuItem onClick={() => undefined} disabled>
            Disabled
          </ContextMenuItem>
          <ContextMenuItem onClick={() => undefined}>Last</ContextMenuItem>
          <input
            aria-label="Fallback link"
            readOnly
            value="https://example.test/title"
          />
        </ContextMenu>
      ) : null}
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }

      observe = vi.fn();

      disconnect = vi.fn();
    },
  );
  height = 100;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 220,
      bottom: height,
      width: 220,
      height,
      toJSON: () => ({}),
    }),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  act(() => container.querySelector("button")!.click());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("card context menu", () => {
  it("preserves native text-selection keys when a fallback link input is focused", () => {
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Fallback link"]',
    )!;
    input.focus();
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      act(() => input.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(input);
    }
  });

  it("portals inside the containing details dialog and adjusts after asynchronous size changes", () => {
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.parentElement).toBe(
      container.querySelector("[data-details-modal-panel]"),
    );
    expect(menu.classList.contains("pointer-events-auto")).toBe(true);
    expect(menu.style.left).toBe(`${window.innerWidth - 228}px`);
    expect(menu.style.top).toBe(`${window.innerHeight - 108}px`);
    height = 250;
    act(() => resize?.());
    expect(menu.style.top).toBe(`${window.innerHeight - 258}px`);
  });

  it("moves keyboard focus past disabled actions and keeps Escape from closing the parent dialog", () => {
    const actions = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ];
    expect(document.activeElement).toBe(actions[0]);
    act(() =>
      actions[0].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(actions[2]);
    const parentEscape = vi.fn();
    window.addEventListener("keydown", parentEscape);
    act(() =>
      actions[2].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(parentEscape).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("button"));
    window.removeEventListener("keydown", parentEscape);
  });

  it("closes on an outside pointer without closing when a menu action is pressed", () => {
    act(() =>
      document
        .querySelector('[role="menuitem"]')!
        .dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
