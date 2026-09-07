import { ReactNode, useId } from "react";

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-dropdown-background px-5 py-4"
      data-theme-surface
    >
      <div className="min-w-0">
        <p className="font-bold text-white">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-type-secondary">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
export function SettingToggle({
  title,
  description,
  enabled,
  onChange,
  disabled = false,
}: {
  title: string;
  description?: string;
  enabled: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg bg-dropdown-background px-5 py-4"
      data-theme-surface
    >
      <div>
        <label className="font-bold text-white cursor-pointer" htmlFor={id}>
          {title}
        </label>
        {description ? (
          <p
            id={`${id}-description`}
            className="mt-1 text-sm text-type-secondary"
          >
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`tabbable relative h-6 w-11 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${enabled ? "bg-buttons-toggle" : "bg-buttons-toggleDisabled"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
