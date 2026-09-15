import { useEffect, useState } from "react";

import {
  GamepadAction,
  defaultGamepadMapping,
  gamepadActions,
  gamepadButtonLabel,
  useGamepadStore,
} from "@/stores/gamepad";

export function GamepadSettings() {
  const { enabled, mapping } = useGamepadStore();
  const [controllers, setControllers] = useState<string[]>([]);
  useEffect(() => {
    const update = () =>
      setControllers(
        Array.from(navigator.getGamepads?.() ?? [])
          .filter((pad): pad is Gamepad => !!pad)
          .map((pad) => pad.id),
      );
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            useGamepadStore.setState({ enabled: e.target.checked })
          }
        />{" "}
        Enable controller input
      </label>
      <p className="text-sm text-type-secondary">
        {controllers.length
          ? controllers.join(", ")
          : "Connect a controller and press a button to let your browser detect it."}{" "}
        The left stick moves focus. Button mappings below apply in the player.
      </p>
      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(mapping).map(([button, action]) => (
            <label
              key={button}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>{gamepadButtonLabel(Number(button), controllers[0])}</span>
              <select
                className="min-w-0 max-w-[70%] rounded-lg bg-dropdown-background p-2 text-white tabbable"
                value={action}
                onChange={(e) =>
                  useGamepadStore.setState({
                    mapping: {
                      ...mapping,
                      [button]: e.target.value as GamepadAction,
                    },
                  })
                }
              >
                {Object.entries(gamepadActions).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      {enabled ? (
        <button
          type="button"
          className="tabbable rounded-lg bg-buttons-cancel px-3 py-2"
          onClick={() =>
            useGamepadStore.setState({ mapping: { ...defaultGamepadMapping } })
          }
        >
          Reset controller mapping
        </button>
      ) : null}
    </div>
  );
}
