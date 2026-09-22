import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpandableBiography } from "./ExpandableBiography";

let host: HTMLDivElement;
let root: Root;
let resize: () => void;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn((callback: () => void) => {
      resize = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(120);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(140);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("person biography expansion", () => {
  it("allows a short biography with more than six lines to expand and collapse", async () => {
    await act(async () =>
      root.render(
        <ExpandableBiography
          text={"One\nTwo\nThree\nFour\nFive\nSix\nSeven"}
        />,
      ),
    );
    expect(host.querySelector("button")?.textContent).toBe("Read more");
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector("p")?.classList.contains("line-clamp-6")).toBe(
      false,
    );
    expect(host.querySelector("button")?.getAttribute("aria-expanded")).toBe(
      "true",
    );
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector("p")?.classList.contains("line-clamp-6")).toBe(
      true,
    );
  });
  it("shows the toggle when a narrower viewport causes previously fitting text to overflow", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
    await act(async () =>
      root.render(<ExpandableBiography text="A brief biography." />),
    );
    expect(host.querySelector("button")).toBeNull();
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(140);
    await act(async () => resize());
    expect(host.querySelector("button")?.textContent).toBe("Read more");
  });
});
