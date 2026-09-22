import { act } from "react";
import { Root, createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CarouselNavButtons } from "./CarouselNavButtons";

let host: HTMLDivElement;
let root: Root;
let carousel: HTMLDivElement;
let scroll: Mock<[ScrollToOptions], void>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  carousel = document.createElement("div");
  document.body.append(carousel);
  carousel.style.columnGap = "16px";
  vi.spyOn(carousel, "getBoundingClientRect").mockReturnValue({
    width: 500,
  } as DOMRect);
  scroll = vi.fn((options: ScrollToOptions) => {
    carousel.scrollLeft = options.left ?? 0;
  });
  Object.defineProperty(carousel, "scrollTo", { value: scroll });
});
afterEach(async () => {
  await act(async () => root.unmount());
  carousel.remove();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("carousel navigation geometry", () => {
  it.each(["person", "trailer", "poster"])(
    "scrolls %s cards without relying on anchor elements",
    async (kind) => {
      const spacer = document.createElement("div");
      carousel.append(spacer);
      vi.spyOn(spacer, "getBoundingClientRect").mockReturnValue({
        width: 48,
      } as DOMRect);
      const card = document.createElement(kind === "poster" ? "div" : "button");
      if (kind === "poster") card.append(document.createElement("a"));
      carousel.append(card);
      const width = kind === "person" ? 128 : kind === "trailer" ? 384 : 180;
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        width,
      } as DOMRect);
      await act(async () =>
        root.render(
          <CarouselNavButtons
            categorySlug="items"
            carouselRefs={{ current: { items: carousel } }}
          />,
        ),
      );
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>('[aria-label="Next items"]')!
          .click(),
      );
      expect(carousel.scrollLeft).toBe((width + 16) * 2);
      expect(scroll).toHaveBeenLastCalledWith({
        left: (width + 16) * 2,
        behavior: "smooth",
      });
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>('[aria-label="Previous items"]')!
          .click(),
      );
      expect(carousel.scrollLeft).toBe(0);
    },
  );
  it("uses immediate scrolling for reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const card = document.createElement("button");
    carousel.append(card);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      width: 128,
    } as DOMRect);
    await act(async () =>
      root.render(
        <CarouselNavButtons
          categorySlug="items"
          carouselRefs={{ current: { items: carousel } }}
        />,
      ),
    );
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Next items"]')!
        .click(),
    );
    expect(scroll).toHaveBeenLastCalledWith({ left: 288, behavior: "auto" });
  });
});
