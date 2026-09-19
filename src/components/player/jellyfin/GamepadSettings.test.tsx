// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultGamepadMapping, useGamepadStore } from "@/stores/gamepad";

import { GamepadMappingEditor } from "./GamepadSettings";

vi.mock("@/components/form/Dropdown", () => ({
  Dropdown: ({ selectedItem, options, setSelectedItem }: any) => (
    <select
      value={selectedItem.id}
      onChange={(event) =>
        setSelectedItem(
          options.find((option: any) => option.id === event.target.value),
        )
      }
    >
      {options.map((option: any) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  ),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const close = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useGamepadStore.setState({
    enabled: true,
    mapping: { ...defaultGamepadMapping, 0: "mute" },
  });
  close.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <GamepadMappingEditor onClose={close} />
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(text: string) {
  act(() =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === text)!
      .click(),
  );
}
function change(action: string) {
  const select = container.querySelector(
    '[data-controller-button="0"] select',
  )! as HTMLSelectElement;
  act(() => {
    select.value = action;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("controller mapping draft", () => {
  it("discards edits and resets when cancelled", () => {
    change("play");
    expect(useGamepadStore.getState().mapping[0]).toBe("mute");
    click("Reset all to default");
    expect(useGamepadStore.getState().mapping[0]).toBe("mute");
    click("Cancel");
    expect(useGamepadStore.getState().mapping[0]).toBe("mute");
    expect(close).toHaveBeenCalledOnce();
  });
  it("saves all changes only on Save and changes displayed controller labels", () => {
    click("PlayStation");
    expect(
      container.querySelector('[data-controller-button="0"] kbd')?.textContent,
    ).toBe("Cross");
    change("next");
    click("Save");
    expect(useGamepadStore.getState().mapping[0]).toBe("next");
    expect(close).toHaveBeenCalledOnce();
  });
});
