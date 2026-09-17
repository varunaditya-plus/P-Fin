import { ReactNode, useId } from "react";

import { Icon, Icons } from "@/components/Icon";

export function SettingGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: Icons;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Icon icon={icon} className="text-base text-type-secondary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-type-secondary">
          {title}
        </h3>
      </div>
      <div
        className="overflow-visible rounded-xl bg-dropdown-background/30 ring-1 ring-white/5 divide-y divide-white/5"
        data-theme-surface
      >
        {children}
      </div>
    </section>
  );
}

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold leading-snug text-white">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-snug text-type-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 shrink-0 max-w-full">{children}</div>
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
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 px-4 py-3 select-none transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/[0.03]"}`}
    >
      <span className="min-w-0">
        <span className="block font-semibold leading-snug text-white">
          {title}
        </span>
        {description ? (
          <span
            id={`${id}-description`}
            className="mt-1 block text-sm leading-snug text-type-secondary"
          >
            {description}
          </span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`tabbable relative mt-0.5 h-6 w-11 shrink-0 rounded-full p-1 transition-colors ${enabled ? "bg-buttons-toggle" : "bg-buttons-toggleDisabled"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </label>
  );
}
