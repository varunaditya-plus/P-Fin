import { useEffect, useId, useState } from "react";

import { Icon, Icons } from "@/components/Icon";

export function PlaybackSlider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  unit = "%",
  onChange,
  onReset,
  allowDirectInput = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  unit?: string;
  onChange: (value: number) => void;
  onReset: () => void;
  allowDirectInput?: boolean;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed))
      onChange(Math.max(min, Math.min(max, parsed)));
    setEditing(false);
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-sm text-type-secondary">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {allowDirectInput ? (
            editing ? (
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={draft}
                autoFocus
                aria-label={`${label} value`}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditing(false);
                  }
                }}
                className="w-16 bg-video-context-light/10 rounded px-1.5 py-0.5 text-sm text-white tabular-nums"
              />
            ) : (
              <button
                type="button"
                aria-label={`Edit ${label.toLowerCase()}`}
                className="text-sm text-white tabular-nums tabbable hover:text-video-context-type-accent"
                onClick={() => setEditing(true)}
              >
                {value}
                {unit}
              </button>
            )
          ) : (
            <span className="text-sm text-white tabular-nums">
              {value}
              {unit}
            </span>
          )}
          {value !== defaultValue ? (
            <button
              type="button"
              aria-label={`Reset ${label.toLowerCase()}`}
              className="text-xs text-type-secondary hover:text-white tabbable"
              onClick={onReset}
            >
              <Icon icon={Icons.REPEAT} className="text-sm" />
            </button>
          ) : null}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-video-context-light cursor-pointer"
      />
    </div>
  );
}
