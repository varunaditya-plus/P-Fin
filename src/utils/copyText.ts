/** Return success only after the browser confirms that text reached its clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* A LAN origin may still allow the user-initiated copy fallback. */
  }
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.setAttribute("tabindex", "-1");
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  // Stay inside any active dialog focus trap while performing the LAN fallback.
  const host =
    active instanceof HTMLElement && active !== document.body
      ? (active.parentElement ?? document.body)
      : document.body;
  host.appendChild(input);
  let copied = false;
  try {
    input.select();
    copied =
      typeof document.execCommand === "function" &&
      document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    input.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
  return copied;
}
