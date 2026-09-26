// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DetailsModalFrame } from "@/components/overlays/DetailsModalFrame";
import { offerAppUpdate, useAppUpdateStore } from "@/setup/appUpdates";

import { UpdateNotification } from "./UpdateNotification";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  useAppUpdateStore.setState({
    available: undefined,
    dismissed: [],
    applying: false,
    error: undefined,
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("keeps focus on the current action and offers only an explicit Refresh button", async () => {
  const apply = vi.fn().mockResolvedValue(undefined);
  await act(async () =>
    root.render(
      <>
        <button type="button">Playing</button>
        <UpdateNotification />
      </>,
    ),
  );
  container.querySelector("button")!.focus();
  const focused = document.activeElement;
  await act(async () => offerAppUpdate("one", apply));
  expect(document.activeElement).toBe(focused);
  const toast = document.querySelector('[aria-label="App update"]')!;
  expect(toast.textContent).toContain("stops playback");
  expect(toast.querySelectorAll("button")).toHaveLength(1);
  expect(toast.querySelector("button")!.textContent).toBe("Refresh");
  expect(
    document.querySelector('[aria-label="Dismiss this update"]'),
  ).toBeNull();
  expect(apply).not.toHaveBeenCalled();
  const refresh = toast.querySelector("button")!;
  await act(async () => refresh.click());
  expect(apply).toHaveBeenCalledOnce();
});
it.each([true, false])(
  "keeps Refresh reachable with a details modal open (update offered first: %s)",
  async (offerFirst) => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();

        disconnect = vi.fn();
      },
    );
    const apply = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    if (offerFirst) offerAppUpdate("one", apply);
    await act(async () =>
      root.render(
        <HelmetProvider>
          <UpdateNotification />
          <DetailsModalFrame
            open
            onClose={close}
            afterLeave={() => {}}
            label="Film"
          >
            <button type="button">Play</button>
          </DetailsModalFrame>
        </HelmetProvider>,
      ),
    );
    await act(async () => vi.advanceTimersByTimeAsync(650));
    const focused = document.activeElement;
    if (!offerFirst) await act(async () => offerAppUpdate("one", apply));
    expect(document.activeElement).toBe(focused);
    const toast = document.querySelector('[aria-label="App update"]')!;
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.inert).toBe(true);
    expect(toast.closest('[aria-hidden="true"], [inert]')).toBeNull();
    for (
      let ancestor = toast.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      expect(ancestor.inert).not.toBe(true);
    }
    const refresh = toast.querySelector("button")!;
    await act(async () => {
      refresh.focus();
      refresh.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      refresh.click();
    });
    expect(document.activeElement).toBe(refresh);
    expect(apply).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  },
);
it("shows an update activation failure and keeps the page available", async () => {
  await act(async () => root.render(<UpdateNotification />));
  await act(async () =>
    offerAppUpdate("one", async () => {
      throw new Error("Update still downloading");
    }),
  );
  const refresh = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Refresh",
  )!;
  await act(async () => refresh.click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Update still downloading",
  );
  expect(refresh.disabled).toBe(false);
});
