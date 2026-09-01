import classNames from "classnames";
import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuProps {
  x: number;
  y: number;
  anchor: HTMLElement;
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ContextMenu({
  x,
  y,
  anchor,
  label,
  onClose,
  children,
  className,
}: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return undefined;
    const place = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
        y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
      };
      setPosition((previous) =>
        previous.x === next.x && previous.y === next.y ? previous : next,
      );
    };
    place();
    (
      element.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)') ??
      element
    ).focus();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(place)
        : undefined;
    observer?.observe(element);
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) close.current();
    };
    const scroll = (event: Event) => {
      if (!element.contains(event.target as Node)) close.current();
    };
    const resize = () => close.current();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      if (element.contains(document.activeElement) && anchor.isConnected)
        anchor.focus();
    };
  }, [x, y, anchor]);

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className={classNames(
        "pointer-events-auto fixed z-[200] bg-dropdown-background rounded-xl shadow-xl border border-white/10 py-2 text-sm text-white min-w-[200px] max-h-[300px] overflow-y-auto backdrop-blur-md custom-scrollbar",
        className,
      )}
      style={{
        top: position.y,
        left: position.x,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "min(300px, calc(100dvh - 16px))",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          close.current();
          return;
        }
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            "input, textarea, [contenteditable='true'], [contenteditable='']",
          )
        )
          return;
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        const items = [
          ...(menu.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          ) ?? []),
        ];
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length;
        items[next]?.focus();
      }}
    >
      {children}
    </div>,
    anchor.closest("[data-details-modal-panel]") ?? document.body,
  );
}

export function ContextMenuItem({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={classNames(
        "w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors outline-none",
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "hover:bg-white/10 focus:bg-white/10 cursor-pointer text-white",
        className,
      )}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onClick();
      }}
    >
      {children}
    </button>
  );
}

export function ContextMenuDivider() {
  return <div role="separator" className="h-px bg-white/10 my-1 w-full" />;
}
