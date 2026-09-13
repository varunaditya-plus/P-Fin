// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
});
it("keeps focus on the current action, dismisses by version, and refreshes only on a click", async () => {
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
  expect(container.textContent).toContain("stops playback");
  expect(apply).not.toHaveBeenCalled();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Dismiss this update"]')!
      .click(),
  );
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(container.querySelector('[aria-label="App update"]')).toBeNull();
  await act(async () => offerAppUpdate("one", apply));
  expect(container.querySelector('[aria-label="App update"]')).toBeNull();
  await act(async () => offerAppUpdate("two", apply));
  const refresh = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Refresh",
  )!;
  await act(async () => refresh.click());
  expect(apply).toHaveBeenCalledOnce();
});
it("shows an update activation failure and keeps the page available", async () => {
  await act(async () => root.render(<UpdateNotification />));
  await act(async () =>
    offerAppUpdate("one", async () => {
      throw new Error("Update still downloading");
    }),
  );
  const refresh = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Refresh",
  )!;
  await act(async () => refresh.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Update still downloading",
  );
  expect(refresh.disabled).toBe(false);
});
