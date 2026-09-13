// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, expect, it, vi } from "vitest";

import { copyText } from "./copyText";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "execCommand");
});
it("reports a confirmed clipboard write", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  expect(await copyText("report")).toBe(true);
  expect(writeText).toHaveBeenCalledWith("report");
});
it("uses a LAN-compatible fallback and restores focus", async () => {
  vi.stubGlobal("navigator", {});
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();
  const execCommand = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, "execCommand", {
    value: execCommand,
    configurable: true,
  });
  expect(await copyText("report")).toBe(true);
  expect(execCommand).toHaveBeenCalledWith("copy");
  expect(document.activeElement).toBe(input);
  expect(document.querySelector("textarea")).toBeNull();
});
it("does not claim Copied when both mechanisms fail", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
  Object.defineProperty(document, "execCommand", {
    value: () => false,
    configurable: true,
  });
  expect(await copyText("report")).toBe(false);
});

it("keeps the fallback selection inside the active modal's focus boundary", async () => {
  vi.stubGlobal("navigator", {});
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  const button = document.createElement("button");
  dialog.appendChild(button);
  document.body.appendChild(dialog);
  button.focus();
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: () =>
      document.querySelector("textarea")?.closest('[role="dialog"]') === dialog,
  });
  expect(await copyText("private stream")).toBe(true);
  expect(document.activeElement).toBe(button);
});
