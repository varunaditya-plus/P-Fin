// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { Dropdown } from "./Dropdown";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function RecreatedChoices() {
  const [selected, setSelected] = useState("spanish");
  const options = [
    { id: "english", name: "English" },
    { id: "spanish", name: "Spanish" },
    { id: "french", name: "French" },
  ];
  return (
    <Dropdown
      selectedItem={{
        id: selected,
        name: options.find((option) => option.id === selected)!.name,
      }}
      options={options}
      setSelectedItem={(option) => setSelected(option.id)}
    />
  );
}

async function key(element: Element, value: string) {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  });
}

it("selects the current option by id and restores its keyboard position after choosing a different value", async () => {
  await act(async () => root.render(<RecreatedChoices />));
  const button = container.querySelector<HTMLButtonElement>("button")!;
  await key(button, "ArrowDown");
  let listbox = container.querySelector('[role="listbox"]')!;
  let selected = container.querySelector('[aria-selected="true"]')!;
  expect(selected?.textContent).toBe("Spanish");
  expect(listbox.getAttribute("aria-activedescendant")).toBe(selected.id);

  await key(listbox, "ArrowDown");
  await key(listbox, "Enter");
  expect(button.textContent).toBe("French");

  await key(button, "ArrowDown");
  listbox = container.querySelector('[role="listbox"]')!;
  selected = container.querySelector('[aria-selected="true"]')!;
  expect(selected?.textContent).toBe("French");
  expect(listbox.getAttribute("aria-activedescendant")).toBe(selected.id);
});
