// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it } from "vitest";

import {
  builtinThemeIds,
  defaultPalette,
  defaultThemeSettings,
  themeVariables,
  validateCustomTheme,
  validateThemeSettings,
} from "./customThemes";

import { useThemeStore } from "./index";

describe("custom themes", () => {
  beforeEach(() => useThemeStore.setState(defaultThemeSettings));
  it("independently applies hex colours to accent, text and background previews", () => {
    const vars = themeVariables({
      ...defaultPalette,
      primaryHex: "#ff0000",
      secondaryHex: "#00ff00",
      tertiaryHex: "#0000ff",
    });
    expect(vars["--colors-buttons-purple"]).toBe("255 0 0");
    expect(vars["--colors-type-text"]).toBe("0 255 0");
    expect(vars["--colors-background-main"]).toBe("0 0 255");
    expect(vars["--colors-themePreview-primary"]).toBe("255 0 0");
    expect(vars["--colors-themePreview-secondary"]).toBe("0 255 0");
  });
  it("allows editing at the 30-theme limit, then selects a visible fallback on deletion", () => {
    for (let index = 0; index < 30; index += 1)
      useThemeStore.getState().saveCustomTheme({
        ...defaultPalette,
        id: `custom-${index}`,
        name: `Theme ${index}`,
      });
    expect(() =>
      useThemeStore.getState().saveCustomTheme({
        ...defaultPalette,
        id: "custom-over",
        name: "Extra",
      }),
    ).toThrow("30");
    useThemeStore
      .getState()
      .saveCustomTheme({ ...defaultPalette, id: "custom-0", name: "Edited" });
    expect(useThemeStore.getState().savedCustomThemes[0].name).toBe("Edited");
    useThemeStore.getState().setTheme("custom-0");
    useThemeStore.getState().deleteCustomTheme("custom-0");
    expect(useThemeStore.getState().theme).toBe("default");
  });
  it("preserves contrasting surface, hover and text tones when overriding a palette", () => {
    const vars = themeVariables({
      ...defaultPalette,
      primaryHex: "#8b5cf6",
      secondaryHex: "#d6ddff",
      tertiaryHex: "#202040",
    });
    expect(vars["--colors-background-main"]).toBe("32 32 64");
    expect(vars["--colors-background-secondary"]).not.toBe(
      vars["--colors-background-main"],
    );
    expect(vars["--colors-dropdown-background"]).not.toBe(
      vars["--colors-background-main"],
    );
    expect(vars["--colors-buttons-purpleHover"]).not.toBe(
      vars["--colors-buttons-purple"],
    );
    expect(vars["--colors-type-secondary"]).not.toBe(
      vars["--colors-type-text"],
    );
    expect(vars["--colors-buttons-primaryText"]).not.toBe(
      vars["--colors-buttons-primary"],
    );
    const preset = themeVariables(defaultPalette);
    for (const [key, value] of Object.entries(preset)) {
      if (value === "0 0 0" || value === "255 255 255") {
        if (
          ![
            "--colors-buttons-purple",
            "--colors-type-text",
            "--colors-background-main",
            "--colors-themePreview-secondary",
            "--colors-themePreview-ghost",
          ].includes(key)
        )
          expect(vars[key]).toBe(value);
      }
    }
  });
  it("cannot hide the final usable theme and restores all themes on reset", () => {
    const checked = validateThemeSettings({
      ...defaultThemeSettings,
      hiddenDefaultThemes: builtinThemeIds,
    });
    expect(checked.hiddenDefaultThemes).not.toContain("default");
    expect(checked.theme).toBe("default");
    useThemeStore.getState().hideDefaultTheme("default");
    expect(useThemeStore.getState().theme).not.toBe("default");
    useThemeStore.getState().resetThemes();
    expect(useThemeStore.getState().hiddenDefaultThemes).toEqual([]);
  });
  it("rejects invalid imported CSS values, names, identifiers and duplicate IDs", () => {
    const valid = { ...defaultPalette, id: "custom-example", name: "Theme" };
    expect(() =>
      validateCustomTheme({ ...valid, primaryHex: "red; color:red" }),
    ).toThrow("hexadecimal");
    expect(() =>
      validateCustomTheme({ ...valid, id: "custom-x}body{" }),
    ).toThrow("identifier");
    expect(() => validateCustomTheme({ ...valid, name: " " })).toThrow("name");
    expect(() =>
      validateThemeSettings({
        ...defaultThemeSettings,
        savedCustomThemes: [valid, valid],
      }),
    ).toThrow("unique");
  });
});
