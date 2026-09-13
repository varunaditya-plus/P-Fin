// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateWaitingWorker,
  applyAppUpdate,
  buildVersion,
  dismissAppUpdate,
  offerAppUpdate,
  startAppUpdateMonitor,
  useAppUpdateStore,
} from "./appUpdates";

const html = (version: string) =>
  `<html><head><script type="module" crossorigin src="/assets/index-${version}.js"></script></head></html>`;
let cleanups: (() => void)[];
const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  cleanups = [];
  document.head.innerHTML =
    '<script type="module" src="/assets/index-current.js"></script>';
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(html("next")));
  useAppUpdateStore.setState({
    available: undefined,
    dismissed: [],
    applying: false,
    error: undefined,
  });
  localStorage.clear();
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.head.innerHTML = "";
});
async function settle() {
  for (let n = 0; n < 15; n += 1) await Promise.resolve();
}
describe("explicit app updates", () => {
  it("identifies the site's existing module build and ignores external scripts", () => {
    const doc = new DOMParser().parseFromString(
      `${html("next")}<script type="module" src="https://other.test/assets/tracker.js"></script>`,
      "text/html",
    );
    expect(buildVersion(doc, "http://localhost/")).toBe(
      "/assets/index-next.js",
    );
    expect(
      buildVersion(
        new DOMParser().parseFromString("<h1>Login required</h1>", "text/html"),
        "http://localhost/",
      ),
    ).toBeUndefined();
  });
  it("checks on load, every ten minutes and when visible without reloading until requested", async () => {
    const reload = vi.fn();
    cleanups.push(
      startAppUpdateMonitor({ baseUrl: "http://localhost/", reload }),
    );
    await settle();
    expect(useAppUpdateStore.getState().available?.version).toBe(
      "build:/assets/index-next.js",
    );
    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe("/index.html");
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(reload).not.toHaveBeenCalled();
    await applyAppUpdate();
    expect(reload).toHaveBeenCalledOnce();
  });
  it("dismisses the same version across checks but offers a later version", async () => {
    const refresh = vi.fn();
    offerAppUpdate("one", refresh);
    dismissAppUpdate();
    offerAppUpdate("one", refresh);
    expect(useAppUpdateStore.getState().dismissed).toContain("one");
    expect(
      JSON.parse(localStorage.getItem("movie-fin-dismissed-updates")!),
    ).toContain("one");
    offerAppUpdate("two", refresh);
    expect(useAppUpdateStore.getState().dismissed).not.toContain("two");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("skips offline checks and quietly tolerates failed background requests", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const reload = vi.fn();
    cleanups.push(
      startAppUpdateMonitor({ baseUrl: "http://localhost/", reload }),
    );
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    window.dispatchEvent(new Event("online"));
    await settle();
    expect(useAppUpdateStore.getState().available).toBeUndefined();
    expect(useAppUpdateStore.getState().error).toBeUndefined();
    expect(reload).not.toHaveBeenCalled();
  });
  it("does not reload on another tab's service-worker activation", async () => {
    const workers = new EventTarget();
    const worker = Object.assign(new EventTarget(), {
      state: "installed",
      postMessage: vi.fn(),
    });
    const registration = Object.assign(new EventTarget(), {
      waiting: worker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    });
    Object.assign(workers, {
      register: vi.fn().mockResolvedValue(registration),
    });
    vi.stubGlobal("navigator", { onLine: true, serviceWorker: workers });
    const reload = vi.fn();
    cleanups.push(
      startAppUpdateMonitor({
        baseUrl: "http://localhost/",
        pwa: true,
        reload,
      }),
    );
    await settle();
    workers.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
    expect(worker.postMessage).not.toHaveBeenCalled();
    const apply = applyAppUpdate();
    await settle();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
    worker.state = "activated";
    worker.dispatchEvent(new Event("statechange"));
    await apply;
    expect(reload).toHaveBeenCalledOnce();
  });
  it("bounds an unresponsive service worker without reloading", async () => {
    const worker = Object.assign(new EventTarget(), {
      state: "installed",
      postMessage: vi.fn(),
    });
    const promise = activateWaitingWorker({
      waiting: worker,
    } as unknown as ServiceWorkerRegistration);
    const result = expect(promise).rejects.toThrow("still preparing");
    await vi.advanceTimersByTimeAsync(15000);
    await result;
  });
});
