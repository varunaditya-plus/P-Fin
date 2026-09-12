// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { copyText } from "@/utils/copyText";

import { ErrorCard, ErrorCardInPlainModal } from "./ErrorCard";

vi.mock("@/utils/copyText", () => ({ copyText: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
it("shows the same full report it copies, and confirms only a successful write", async () => {
  let finish: (success: boolean) => void = () => {};
  vi.mocked(copyText).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () =>
    root.render(
      <ErrorCard
        error={new Error("Full native failure")}
        componentStack="at LastComponent"
        onClose={() => {}}
      />,
    ),
  );
  const report = container.querySelector("pre")!.textContent;
  expect(report).toContain("Full native failure");
  expect(report).toContain("at LastComponent");
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Copy error report"]')!
      .click(),
  );
  expect(copyText).toHaveBeenCalledWith(report);
  expect(container.querySelector('[aria-label="Copied"]')).toBeNull();
  await act(async () => finish(true));
  expect(container.querySelector('[aria-label="Copied"]')).not.toBeNull();
});
it("exposes a manual-copy failure without claiming success", async () => {
  vi.mocked(copyText).mockResolvedValue(false);
  await act(async () =>
    root.render(<ErrorCard error="Failure" onClose={() => {}} />),
  );
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Copy error report"]')!
      .click(),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not copy",
  );
  expect(container.querySelector('[aria-label="Copied"]')).toBeNull();
  expect(container.querySelector("pre")?.getAttribute("tabindex")).toBe("0");
});
it("traps focus and closes with Escape without needing a router", async () => {
  const close = vi.fn();
  await act(async () =>
    root.render(
      <ErrorCardInPlainModal
        show
        error={new Error("Render failure")}
        onClose={close}
      />,
    ),
  );
  await act(async () => vi.advanceTimersByTimeAsync(50));
  expect(
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  ).toBe(true);
  await act(async () =>
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(close).toHaveBeenCalledOnce();
});
