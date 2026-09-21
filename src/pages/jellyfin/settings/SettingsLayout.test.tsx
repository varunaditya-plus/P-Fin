import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it } from "vitest";

import { SettingToggle } from "./SettingRow";
import { SettingsLayout, SettingsPageSection } from "./SettingsLayout";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Controls() {
  const [enabled, setEnabled] = useState(false);
  return (
    <SettingToggle
      title="Hold to boost"
      enabled={enabled}
      onChange={setEnabled}
    />
  );
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <SettingsLayout>
          <SettingsPageSection id="preferences">
            <Controls />
          </SettingsPageSection>
          <SettingsPageSection id="appearance">
            <p>Theme collection</p>
          </SettingsPageSection>
          <SettingsPageSection id="captions">
            <p>Caption appearance</p>
          </SettingsPageSection>
        </SettingsLayout>
      </MemoryRouter>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("filters categories without resetting control values", async () => {
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
  );
  const appearance = [
    ...host.querySelectorAll<HTMLButtonElement>("nav button"),
  ].find((button) => button.textContent === "Appearance")!;
  await act(async () => appearance.click());
  expect(host.querySelector<HTMLElement>("#settings-preferences")!.hidden).toBe(
    true,
  );
  expect(host.querySelector<HTMLElement>("#settings-appearance")!.hidden).toBe(
    false,
  );
  await act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>("nav button")]
      .find((button) => button.textContent === "Preferences")!
      .click(),
  );
  expect(
    host.querySelector('[role="switch"]')!.getAttribute("aria-checked"),
  ).toBe("true");
});
it("searches settings across categories and reports an empty result", async () => {
  const input = host.querySelector<HTMLInputElement>("input")!;
  const search = async (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await search("caption position");
  expect(host.querySelector<HTMLElement>("#settings-captions")!.hidden).toBe(
    false,
  );
  expect(host.querySelector<HTMLElement>("#settings-appearance")!.hidden).toBe(
    true,
  );
  await search("not-a-setting");
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "No settings match",
  );
});
it("lets the whole toggle row activate its labelled control exactly once", async () => {
  await act(async () => host.querySelector<HTMLLabelElement>("label")!.click());
  expect(
    host.querySelector('[role="switch"]')!.getAttribute("aria-checked"),
  ).toBe("true");
});

it("opens the preferences category from the keyboard guide link", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter
        key="guide-link"
        initialEntries={["/settings?category=settings-preferences"]}
      >
        <SettingsLayout>
          <SettingsPageSection id="preferences">
            <p>Player controls</p>
          </SettingsPageSection>
          <SettingsPageSection id="appearance">
            <p>Themes</p>
          </SettingsPageSection>
        </SettingsLayout>
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector<HTMLElement>("#settings-preferences")!.hidden).toBe(
    false,
  );
  expect(host.querySelector<HTMLElement>("#settings-appearance")!.hidden).toBe(
    true,
  );
});
