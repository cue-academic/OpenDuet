import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { StudyDock } from "@/components/shell/study-dock";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost:3010" }));
afterEach(cleanup);
afterAll(() => GlobalRegistrator.unregister());

test("the hub has seven plain unselected links and no extra heading or numbers", () => {
  window.history.replaceState(null, "", "/");
  const view = render(<StudyDock />);
  const links = view.getAllByRole("link");
  expect(links).toHaveLength(7);
  expect(view.queryByRole("heading")).toBeNull();
  expect(view.container.textContent).not.toMatch(/0[1-7]|Pick up where/);
  for (const link of links) {
    expect(link.hasAttribute("aria-current")).toBe(false);
    expect(link.querySelector("svg")).toBeNull();
    expect(link.className).not.toMatch(/shadow|rounded|bg-|border|first:/);
  }
});

test("tabs select only the open screen, not an uncompleted request to open one", () => {
  window.history.replaceState(null, "", "/classes");
  const view = render(<StudyDock />);
  expect(
    view.getByRole("link", { name: "Classes" }).getAttribute("aria-current"),
  ).toBe("page");
  act(() =>
    window.dispatchEvent(
      new CustomEvent("academic-os-open", { detail: "/coach" }),
    ),
  );
  expect(
    view.getByRole("link", { name: "Tonight" }).hasAttribute("aria-current"),
  ).toBe(false);
  window.history.replaceState(null, "", "/coach");
  act(() => window.dispatchEvent(new Event("academic-os-navigated")));
  expect(
    view.getByRole("link", { name: "Tonight" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(view.container.querySelectorAll('[aria-current="page"]')).toHaveLength(
    1,
  );
  expect(view.container.innerHTML).not.toContain("before:");
  expect(view.getByRole("link", { name: "Tonight" }).className).toContain(
    "border-b-2",
  );
  for (const link of view.getAllByRole("link")) {
    if (link.getAttribute("aria-current") === "page") continue;
    expect(link.className).not.toMatch(/border|bg-|rounded|shadow/);
  }
});

test("an unmatched route selects nothing and hub links request their screen", () => {
  window.history.replaceState(null, "", "/unknown");
  const view = render(<StudyDock />);
  expect(view.container.querySelector("[aria-current]")).toBeNull();
  window.history.replaceState(null, "", "/");
  act(() => window.dispatchEvent(new Event("popstate")));
  const opened: string[] = [];
  const onOpen = (event: Event) => {
    opened.push((event as CustomEvent<string>).detail);
  };
  window.addEventListener("academic-os-open", onOpen);
  try {
    fireEvent.click(view.getByRole("link", { name: /Classes/ }));
    expect(opened).toEqual(["/classes"]);
  } finally {
    window.removeEventListener("academic-os-open", onOpen);
  }
});
