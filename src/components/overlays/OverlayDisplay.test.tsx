// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useOverlayRouter } from "@/hooks/useOverlayRouter";

import { Overlay, OverlayDisplay } from "./OverlayDisplay";
import { OverlayPage } from "./OverlayPage";
import { OverlayRouter } from "./OverlayRouter";

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => ({ isMobile: false }),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
function Harness() {
  const router = useOverlayRouter("settings");
  const location = useLocation();
  return (
    <OverlayDisplay>
      <output>{location.search}</output>
      <button type="button" onClick={() => router.open()}>
        Open settings
      </button>
      <button type="button" onClick={() => router.close()}>
        Close settings
      </button>
      <Overlay id="settings">
        <OverlayRouter id="settings">
          <OverlayPage id="settings" path="/" height={400} width={300}>
            <button type="button" onClick={() => router.navigate("/download")}>
              Download
            </button>
          </OverlayPage>
          <OverlayPage id="settings" path="/download" height={400} width={300}>
            <p>Current episode downloads</p>
          </OverlayPage>
        </OverlayRouter>
      </Overlay>
    </OverlayDisplay>
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();
    },
  );
  const styles = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (element: Element) => {
    const result = styles(element);
    Object.defineProperty(result, "transitionDuration", {
      value: element.className.includes("transition-") ? "0.2s" : "0s",
    });
    Object.defineProperty(result, "transitionDelay", { value: "0s" });
    return result;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 10,
    width: 300,
    height: 400,
    top: 10,
    left: 10,
    bottom: 410,
    right: 310,
    toJSON: () => {},
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (entry) => entry.textContent === text,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}
it.each([0, 16, 32, 80, 160, 220])(
  "keeps settings mounted when reopened %sms into a nested download exit",
  async (delay) => {
    await act(async () =>
      root.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Harness />
        </MemoryRouter>,
      ),
    );
    await click("Open settings");
    await advance(500);
    await click("Download");
    await advance(500);
    expect(container.textContent).toContain("Current episode downloads");
    await click("Close settings");
    await advance(delay);
    await click("Open settings");
    await advance(1000);
    expect(container.querySelector("output")!.textContent).toBe(
      "?r=%2Fsettings",
    );
    expect(container.querySelector(".popout-wrapper")).not.toBeNull();
    expect(
      [...container.querySelectorAll("button")].some(
        (entry) => entry.textContent === "Download",
      ),
    ).toBe(true);
    expect(container.textContent).not.toContain("Current episode downloads");
  },
);

it("keeps the root page when a close and reopen interrupt nested teardown before its promises settle", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Harness />
      </MemoryRouter>,
    ),
  );
  await click("Open settings");
  await advance(500);
  await click("Download");
  await advance(500);
  const find = (label: string) =>
    [...container.querySelectorAll("button")].find(
      (entry) => entry.textContent === label,
    )!;
  act(() => find("Close settings").click());
  act(() => find("Open settings").click());
  await advance(1000);
  expect(container.querySelector("output")!.textContent).toBe("?r=%2Fsettings");
  expect(container.querySelector(".popout-wrapper")).not.toBeNull();
  expect(find("Download")).toBeDefined();
});
