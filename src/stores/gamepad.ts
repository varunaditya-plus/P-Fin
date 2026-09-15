import { create } from "zustand";
import { persist } from "zustand/middleware";

export const gamepadActions = {
  none: "Unassigned",
  confirm: "Activate focused control",
  back: "Close menu / return to library",
  play: "Play / pause",
  captions: "Toggle subtitles",
  mute: "Mute / unmute",
  previous: "Previous episode",
  next: "Next episode",
  rewind: "Seek back 10 seconds",
  forward: "Seek forward 10 seconds",
  settings: "Open player settings",
  fullscreen: "Toggle fullscreen",
  up: "Focus up",
  down: "Focus down",
  left: "Focus left",
  right: "Focus right",
  quieter: "Volume down",
  louder: "Volume up",
} as const;
export type GamepadAction = keyof typeof gamepadActions;
export const defaultGamepadMapping: Record<number, GamepadAction> = {
  0: "confirm",
  1: "back",
  2: "play",
  3: "captions",
  4: "previous",
  5: "next",
  6: "rewind",
  7: "forward",
  8: "settings",
  9: "fullscreen",
  10: "quieter",
  11: "louder",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
/** Standard Gamepad API positions, with familiar names for supported controllers. */
export function gamepadButtonLabel(index: number, controllerId = "") {
  const xbox = [
    "A",
    "B",
    "X",
    "Y",
    "LB",
    "RB",
    "LT",
    "RT",
    "View",
    "Menu",
    "Left stick press",
    "Right stick press",
    "D-pad up",
    "D-pad down",
    "D-pad left",
    "D-pad right",
    "Xbox button",
  ];
  const playstation = [
    "Cross",
    "Circle",
    "Square",
    "Triangle",
    "L1",
    "R1",
    "L2",
    "R2",
    "Share / Create",
    "Options",
    "L3",
    "R3",
    "D-pad up",
    "D-pad down",
    "D-pad left",
    "D-pad right",
    "PS button",
    "Touchpad press",
  ];
  if (/playstation|dualshock|dualsense|sony|054c/i.test(controllerId))
    return playstation[index] ?? `Button ${index}`;
  if (/xbox|xinput|microsoft|045e/i.test(controllerId))
    return xbox[index] ?? `Button ${index}`;
  const first = xbox[index];
  const second = playstation[index];
  return first && second
    ? first === second
      ? first
      : `${first} / ${second}`
    : `Button ${index}`;
}

export interface GamepadPreferences {
  enabled: boolean;
  mapping: Record<number, GamepadAction>;
}
export function validateGamepad(value: unknown): GamepadPreferences {
  const data = value as Partial<GamepadPreferences> | null;
  const mapping = { ...defaultGamepadMapping };
  for (const [key, action] of Object.entries(data?.mapping ?? {})) {
    if (
      /^(?:[0-9]|1[0-9]|2[0-9]|3[01])$/.test(key) &&
      Object.hasOwn(gamepadActions, action)
    )
      mapping[Number(key)] = action;
  }
  return { enabled: data?.enabled === true, mapping };
}
export const useGamepadStore = create<GamepadPreferences>()(
  persist<GamepadPreferences>(
    () => ({ enabled: false, mapping: { ...defaultGamepadMapping } }),
    {
      name: "movie-fin:gamepad",
      merge: (stored, current) => ({ ...current, ...validateGamepad(stored) }),
    },
  ),
);

/** Button edges and bounded repeat prevent a held confirm/next from firing repeatedly. */
export function pollGamepad(
  pad: Pick<Gamepad, "buttons" | "axes">,
  mapping: Record<number, GamepadAction>,
  held: Map<string, number>,
  now: number,
) {
  const pressed = new Map<string, GamepadAction>();
  pad.buttons.forEach((button, index) => {
    if (button.pressed || button.value > 0.65)
      pressed.set(`b${index}`, mapping[index] ?? "none");
  });
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (Math.abs(x) > 0.6) pressed.set("axisX", x < 0 ? "left" : "right");
  if (Math.abs(y) > 0.6) pressed.set("axisY", y < 0 ? "up" : "down");
  const actions: GamepadAction[] = [];
  for (const key of held.keys()) if (!pressed.has(key)) held.delete(key);
  for (const [key, action] of pressed) {
    const last = held.get(key);
    if (
      last === undefined ||
      ([
        "up",
        "down",
        "left",
        "right",
        "rewind",
        "forward",
        "quieter",
        "louder",
      ].includes(action) &&
        now - last >= 350)
    ) {
      held.set(key, now);
      if (action !== "none") actions.push(action);
    }
  }
  return [...new Set(actions)];
}
