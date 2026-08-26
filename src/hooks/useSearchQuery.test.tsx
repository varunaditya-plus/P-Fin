import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
// Test runners are development dependencies.
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchQuery } from "./useSearchQuery";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function SearchHarness() {
  const [query, updateQuery] = useSearchQuery();
  return (
    <>
      <output>{query}</output>
      <button type="button" onClick={() => updateQuery("100% off / 4K", true)}>
        Search
      </button>
    </>
  );
}

function renderSearch(path: string) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/browse/:query" element={<SearchHarness />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return container;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("library search routes", () => {
  it("keeps percent signs without trying to decode them twice", () => {
    expect(
      renderSearch("/browse/100%25").querySelector("output")?.textContent,
    ).toBe("100%");
  });

  it("preserves literal encoded text as search text", () => {
    expect(
      renderSearch("/browse/%2520").querySelector("output")?.textContent,
    ).toBe("%20");
  });

  it("round-trips reserved characters when a search is committed", () => {
    const rendered = renderSearch("/browse/initial");
    act(() => rendered.querySelector("button")?.click());
    expect(rendered.querySelector("output")?.textContent).toBe("100% off / 4K");
  });
});
