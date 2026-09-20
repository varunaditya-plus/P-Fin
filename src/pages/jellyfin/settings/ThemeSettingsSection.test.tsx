import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePreviewThemeStore, useThemeStore } from "@/stores/theme";
import {
  defaultPalette,
  defaultThemeSettings,
} from "@/stores/theme/customThemes";

import { CustomThemeEditor } from "./ThemeSettingsSection";

vi.mock("@/components/overlays/DetailsModalFrame", () => ({
  DetailsModalFrame: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));
let host: HTMLDivElement;
let root: Root;
const close = vi.fn();
function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
describe("theme editor", () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useThemeStore.setState(defaultThemeSettings);
    close.mockClear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <CustomThemeEditor
            initial={{
              ...defaultPalette,
              id: "custom-preview",
              name: "Preview",
            }}
            onClose={close}
          />
        </MemoryRouter>,
      ),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  it("previews hex changes without changing the active theme and saves the named theme", async () => {
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="Accent custom colour"]',
        )!
        .click(),
    );
    const input = host.querySelector<HTMLInputElement>(
      '[aria-label="Accent hex colour"]',
    )!;
    await act(async () => setInput(input, "#123456"));
    const preview = host.querySelector<HTMLElement>(
      '[data-testid="custom-theme-preview"]',
    )!;
    expect(preview.style.getPropertyValue("--colors-buttons-purple")).toBe(
      "18 52 86",
    );
    expect(useThemeStore.getState().theme).toBe(null);
    expect(usePreviewThemeStore.getState().previewPalette?.primaryHex).toBe(
      "#123456",
    );
    expect(useThemeStore.getState().savedCustomThemes).toEqual([]);
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(useThemeStore.getState().savedCustomThemes[0]).toMatchObject({
      name: "Preview",
      primaryHex: "#123456",
    });
    expect(useThemeStore.getState().theme).toBe("custom-preview");
    expect(close).toHaveBeenCalledOnce();
    expect(usePreviewThemeStore.getState().previewPalette).toBeNull();
  });
  it("rejects an invalid hex colour and leaves existing themes unchanged when cancelled", async () => {
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="Background custom colour"]',
        )!
        .click(),
    );
    await act(async () =>
      setInput(
        host.querySelector<HTMLInputElement>(
          '[aria-label="Background hex colour"]',
        )!,
        "#zzz",
      ),
    );
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "hexadecimal",
    );
    expect(close).not.toHaveBeenCalled();
    await act(async () =>
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Cancel")!
        .click(),
    );
    expect(close).toHaveBeenCalledOnce();
    expect(useThemeStore.getState().savedCustomThemes).toEqual([]);
  });
  it("reopens saved hex colours in custom mode and discards edits on cancel", async () => {
    const saved = {
      ...defaultPalette,
      id: "custom-existing",
      name: "Existing",
      primaryHex: "#aabbcc",
      tertiaryHex: "#101122",
    };
    await act(async () => {
      useThemeStore.getState().saveCustomTheme(saved);
      useThemeStore.getState().setTheme(saved.id);
    });
    await act(async () =>
      root.render(
        <MemoryRouter>
          <CustomThemeEditor key={saved.id} initial={saved} onClose={close} />
        </MemoryRouter>,
      ),
    );
    const field = host.querySelector<HTMLInputElement>(
      '[aria-label="Accent hex colour"]',
    )!;
    expect(field.value).toBe("#aabbcc");
    await act(async () => setInput(field, "#112233"));
    await act(async () =>
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Cancel")!
        .click(),
    );
    expect(useThemeStore.getState().savedCustomThemes[0].primaryHex).toBe(
      "#aabbcc",
    );
    expect(useThemeStore.getState().theme).toBe(saved.id);
    expect(usePreviewThemeStore.getState().previewPalette).toBeNull();
  });
});
