import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GenreChips } from "./GenreChips";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();

      disconnect = vi.fn();
    },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("home genre chips", () => {
  it("keeps collapsed genres out of keyboard navigation and expands/collapses without losing focus", async () => {
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <GenreChips
          genres={[
            "Action",
            "Adventure",
            "Comedy",
            "Drama",
            "Family",
            "Mystery",
            "Custom",
          ]}
          onSelect={onSelect}
        />,
      ),
    );
    const toggle = host.querySelector<HTMLButtonElement>("[aria-expanded]")!;
    const extra = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Mystery",
    )!;
    expect(extra.tabIndex).toBe(-1);
    expect(host.querySelectorAll("svg").length).toBe(8);
    toggle.focus();
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(extra.tabIndex).toBe(0);
    expect(document.activeElement).toBe(toggle);
    await act(async () => extra.click());
    expect(onSelect).toHaveBeenCalledWith("Mystery");
    await act(async () => toggle.click());
    expect(extra.tabIndex).toBe(-1);
    expect(extra.closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
