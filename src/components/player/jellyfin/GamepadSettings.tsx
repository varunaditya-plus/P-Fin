import { useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Toggle } from "@/components/buttons/Toggle";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { Flare } from "@/components/utils/Flare";
import { useConnectedGamepads } from "@/hooks/useConnectedGamepads";
import {
  GamepadAction,
  defaultGamepadMapping,
  gamepadActions,
  gamepadButtonLabel,
  useGamepadStore,
} from "@/stores/gamepad";

const groups = [
  { title: "D-Pad", buttons: [12, 13, 14, 15] },
  { title: "Face buttons", buttons: [0, 1, 2, 3] },
  { title: "Bumpers & triggers", buttons: [4, 5, 6, 7] },
  { title: "System", buttons: [9, 8, 10, 11] },
];
const choices = Object.entries(gamepadActions).map(([id, name]) => ({
  id,
  name,
}));

export function GamepadMappingEditor({
  controllerId = "",
  onClose,
}: {
  controllerId?: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...useGamepadStore.getState().mapping,
  }));
  const [family, setFamily] = useState(
    /playstation|dualshock|dualsense|sony|054c/i.test(controllerId)
      ? "playstation"
      : "xbox",
  );
  const duplicate = useMemo(() => {
    const counts = new Map<GamepadAction, number>();
    Object.values(draft).forEach((action) =>
      counts.set(action, (counts.get(action) ?? 0) + 1),
    );
    return counts;
  }, [draft]);
  const extra = Object.keys(draft)
    .map(Number)
    .filter((button) => button > 15);
  return (
    <div className="space-y-5 text-base">
      <p className="text-xs text-white/40 -mt-2">
        Configure your Xbox or PlayStation controller button mappings.
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            theme={family === "xbox" ? "purple" : "secondary"}
            onClick={() => setFamily("xbox")}
            className="px-3 py-1.5 !text-xs"
          >
            Xbox
          </Button>
          <Button
            theme={family === "playstation" ? "purple" : "secondary"}
            onClick={() => setFamily("playstation")}
            className="px-3 py-1.5 !text-xs"
          >
            PlayStation
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...defaultGamepadMapping })}
          className="tabbable text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5"
        >
          <Icon icon={Icons.RELOAD} />
          Reset all to default
        </button>
      </div>
      <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
        {[
          ...groups,
          ...(extra.length ? [{ title: "Extra buttons", buttons: extra }] : []),
        ].map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h3 className="text-[10px] uppercase tracking-widest text-white/25 font-medium">
              {group.title}
            </h3>
            <div className="space-y-0.5">
              {group.buttons.map((button) => {
                const action = draft[button] ?? "none";
                const conflict =
                  action !== "none" && (duplicate.get(action) ?? 0) > 1;
                return (
                  <div
                    key={button}
                    className="flex items-center gap-3 py-1 px-1.5 rounded hover:bg-white/[0.04] transition-colors"
                    data-controller-button={button}
                  >
                    <kbd
                      title={
                        conflict ? "Another button uses this action" : undefined
                      }
                      className={`inline-flex items-center justify-center min-w-[2.25rem] h-6 px-1.5 text-[11px] font-mono rounded border transition-colors ${conflict ? "border-type-danger text-type-danger bg-type-danger/10" : "border-white/[0.1] text-white/40 bg-white/[0.05]"}`}
                    >
                      {gamepadButtonLabel(button, family)}
                    </kbd>
                    <div className="flex-1 min-w-0">
                      <Dropdown
                        selectedItem={
                          choices.find((choice) => choice.id === action)!
                        }
                        setSelectedItem={(choice) =>
                          setDraft((previous) => ({
                            ...previous,
                            [button]: choice.id as GamepadAction,
                          }))
                        }
                        options={choices}
                        className="w-full !my-0 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
        <Button theme="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          theme="purple"
          onClick={() => {
            useGamepadStore.setState({ mapping: draft });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function GamepadSettings() {
  const enabled = useGamepadStore((state) => state.enabled);
  const controllers = useConnectedGamepads();
  const [open, setOpen] = useState(false);
  const presence = useRetainedModalValue(open || undefined);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-white">Enable controller input</span>
        <Toggle
          label="Enable controller input"
          enabled={enabled}
          onClick={() => useGamepadStore.setState({ enabled: !enabled })}
        />
      </div>
      <p className="text-xs text-type-secondary">
        {controllers.length
          ? controllers.map((pad) => pad.id).join(", ")
          : "Connect a controller and press a button to let your browser detect it."}
      </p>
      <Button theme="secondary" onClick={() => setOpen(true)}>
        Configure controller
      </Button>
      {presence.value ? (
        <DetailsModalFrame
          open={open}
          onClose={() => setOpen(false)}
          afterLeave={presence.afterLeave}
          label="Controller controls"
        >
          <div className="flex absolute inset-0 items-center justify-center p-4 overflow-hidden">
            <Flare.Base className="group rounded-3xl bg-background-main transition-colors duration-300 w-full max-w-2xl p-6 bg-mediaCard-hoverBackground bg-opacity-60 backdrop-filter backdrop-blur-lg shadow-lg max-h-[85dvh] overflow-y-auto pointer-events-auto">
              <Flare.Light
                flareSize={300}
                cssColorVar="--colors-mediaCard-hoverAccent"
                backgroundClass="bg-modal-background duration-100"
                className="rounded-3xl bg-background-main group-hover:opacity-100"
              />
              <Flare.Child>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white pr-6">
                    Controller controls
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close controller controls"
                    className="tabbable p-2 rounded-full hover:bg-video-context-light hover:bg-opacity-20 transition-colors"
                  >
                    <Icon icon={Icons.X} />
                  </button>
                </div>
                <GamepadMappingEditor
                  controllerId={controllers[0]?.id}
                  onClose={() => setOpen(false)}
                />
              </Flare.Child>
            </Flare.Base>
          </div>
        </DetailsModalFrame>
      ) : null}
    </div>
  );
}
