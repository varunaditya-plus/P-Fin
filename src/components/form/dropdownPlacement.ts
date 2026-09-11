export function dropdownPlacement(
  anchor: { left: number; right: number; top: number; bottom: number },
  menuWidth: number,
  viewport: { width: number; height: number },
  preferred: "up" | "down",
  side: "left" | "right",
) {
  const above = Math.max(0, anchor.top - 12);
  const below = Math.max(0, viewport.height - anchor.bottom - 12);
  const direction = (
    preferred === "up"
      ? above >= 240 || above >= below
      : below >= 240 || below >= above
  )
    ? preferred
    : preferred === "up"
      ? "down"
      : "up";
  const width = Math.min(menuWidth, Math.max(0, viewport.width - 16));
  const left = Math.max(
    8,
    Math.min(
      side === "right" ? anchor.right - width : anchor.left,
      viewport.width - width - 8,
    ),
  );
  return {
    direction,
    left: left - anchor.left,
    maxHeight: Math.min(240, direction === "up" ? above : below),
  };
}
