import classNames from "classnames";
import { ReactNode } from "react";

export function SettingsCard({
  children,
  className,
  paddingClass = "px-5 py-4",
}: {
  children: ReactNode;
  className?: string;
  paddingClass?: string;
}) {
  return (
    <div
      className={classNames(
        "w-full rounded-lg bg-settings-card-background bg-opacity-[0.15] border border-settings-card-border",
        paddingClass,
        className,
      )}
      data-theme-surface
    >
      {children}
    </div>
  );
}
