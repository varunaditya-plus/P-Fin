// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from "vitest";

import { createSharedRequest } from "./sharedRequest";

describe("shared discovery requests", () => {
  it("shares one read while allowing a subscriber to cancel independently", async () => {
    let finish: (value: string) => void = () => {};
    let underlying: AbortSignal | undefined;
    const load = vi.fn((signal: AbortSignal) => {
      underlying = signal;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const shared = createSharedRequest<string>();
    const controller = new AbortController();
    const first = shared("same-account:same-page", controller.signal, load);
    const second = shared("same-account:same-page", undefined, load);
    const rejected = expect(first).rejects.toHaveProperty("name", "AbortError");
    controller.abort();
    await rejected;
    expect(underlying?.aborted).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    finish("page");
    await expect(second).resolves.toBe("page");
  });
  it("aborts an unused read and lets a new view start a fresh request", async () => {
    const shared = createSharedRequest<string>();
    let underlying: AbortSignal | undefined;
    const firstController = new AbortController();
    const load = vi.fn((signal: AbortSignal) => {
      underlying = signal;
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      });
    });
    const first = shared("key", firstController.signal, load);
    const rejected = expect(first).rejects.toHaveProperty("name", "AbortError");
    firstController.abort();
    await rejected;
    expect(underlying?.aborted).toBe(true);
    await expect(shared("key", undefined, async () => "fresh")).resolves.toBe(
      "fresh",
    );
  });
});
