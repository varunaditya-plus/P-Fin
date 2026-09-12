// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it } from "vitest";

import { useQueryParams } from "./useQueryParams";

function Query() {
  return <output>{JSON.stringify(useQueryParams())}</output>;
}
it("keeps malformed percent escapes and literal plus values safe without a second decode", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={[
            "/?query=100%25+complete%2B&broken=%E0%A4%A&percent=%",
          ]}
        >
          <Query />
        </MemoryRouter>,
      ),
    );
    const value = JSON.parse(container.querySelector("output")!.textContent!);
    expect(value.query).toBe("100% complete+");
    expect(value.percent).toBe("%");
    expect(value.broken).toContain("%A");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
