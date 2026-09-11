// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it } from "vitest";

import { dropdownPlacement } from "./dropdownPlacement";

it("opens above a bottom-edge trigger and clamps long menus inside the viewport", () => {
  expect(
    dropdownPlacement(
      { left: 330, right: 380, top: 700, bottom: 740 },
      300,
      { width: 390, height: 800 },
      "down",
      "left",
    ),
  ).toEqual({ direction: "up", left: -248, maxHeight: 240 });
});
it("honours preferred direction when it fits and chooses the largest space in a short viewport", () => {
  expect(
    dropdownPlacement(
      { left: 100, right: 220, top: 80, bottom: 110 },
      120,
      { width: 600, height: 300 },
      "up",
      "right",
    ),
  ).toEqual({ direction: "down", left: 0, maxHeight: 178 });
});
