import { useState } from "react";

import { Icon, Icons } from "@/components/Icon";

const speeds = [0.25, 0.5, 1, 1.5, 2];

export function PlaybackSpeedControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (speed: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const custom = !speeds.includes(value);
  const edit = (speed: number) => {
    if (disabled) return;
    setDraft(String(speed));
    setEditing(speed);
    setError("");
  };
  const commit = () => {
    const speed = Number(draft);
    if (!draft.trim() || !Number.isFinite(speed) || speed < 0.1 || speed > 5) {
      setError("Enter a speed from 0.1 to 5.");
      return;
    }
    if (!disabled) onChange(speed);
    setEditing(null);
    setError("");
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center bg-video-context-light/10 p-1 rounded-lg">
        {(custom ? [value] : speeds).map((speed) =>
          editing === speed ? (
            <input
              key={speed}
              type="number"
              step="0.05"
              min="0.1"
              max="5"
              value={draft}
              autoFocus
              aria-label="Custom playback speed"
              disabled={disabled}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                setEditing(null);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
                if (event.key === "Escape") {
                  setEditing(null);
                  setError("");
                }
              }}
              className="min-w-0 w-full rounded-md py-1 bg-transparent text-center text-white tabbable"
            />
          ) : (
            <button
              key={speed}
              type="button"
              disabled={disabled}
              onClick={() => (custom ? edit(speed) : onChange(speed))}
              onDoubleClick={() => edit(speed)}
              aria-label={`${speed}x playback speed`}
              title="Double-click to enter a custom speed"
              className={`w-full px-2 py-1 rounded-md tabbable disabled:opacity-50 disabled:cursor-not-allowed ${value === speed ? "bg-video-context-light/20 text-white" : ""}`}
            >
              {speed}x
            </button>
          ),
        )}
        {custom && editing === null ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Reset playback speed"
            className="tabbable p-2 text-video-context-light/70 hover:text-white disabled:opacity-50"
            onClick={() => onChange(1)}
          >
            <Icon icon={Icons.X} className="text-sm" />
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-type-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
