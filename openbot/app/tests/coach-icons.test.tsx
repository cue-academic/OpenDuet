import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AchievementsCard, Celebration } from "@/components/coach/week";
import { ACHIEVEMENTS } from "@/lib/coach/progress";
import { demoState } from "@/lib/coach/seed";

beforeAll(() => GlobalRegistrator.register());
afterEach(cleanup);
afterAll(() => GlobalRegistrator.unregister());

test("unearned badges are collapsed until Show all, then each uses an SVG", () => {
  const state = demoState(new Date());
  state.unlocked = {};
  const view = render(<AchievementsCard state={state} />);
  expect(view.getByRole("heading", { name: "Badges 0 of 10" })).toBeTruthy();
  expect(view.queryAllByRole("listitem")).toHaveLength(0);
  fireEvent.click(view.getByRole("button", { name: "Show all" }));
  expect(view.getAllByRole("listitem")).toHaveLength(10);
  for (const achievement of ACHIEVEMENTS) {
    const badge = view.getByRole("listitem", {
      name: `${achievement.title}: ${achievement.description}`,
    });
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  }
  expect(view.container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("earned badges are a compact list and can be restored after showing all", () => {
  const state = demoState(new Date());
  state.unlocked = { [ACHIEVEMENTS[0]!.id]: new Date().toISOString() };
  const view = render(<AchievementsCard state={state} />);
  expect(view.getByRole("heading", { name: "Badges 1 of 10" })).toBeTruthy();
  expect(view.getAllByRole("listitem")).toHaveLength(1);
  expect(view.getByRole("listitem").className).not.toMatch(/grid|rounded|bg-/);
  fireEvent.click(view.getByRole("button", { name: "Show all" }));
  expect(view.getAllByRole("listitem")).toHaveLength(10);
  fireEvent.click(view.getByRole("button", { name: "Show earned" }));
  expect(view.getAllByRole("listitem")).toHaveLength(1);
});

test("a celebration uses the earned badge icon and an empty list draws nothing", () => {
  const view = render(<Celebration achievements={[]} onDone={() => {}} />);
  expect(view.queryByRole("status")).toBeNull();
  view.rerender(
    <Celebration achievements={ACHIEVEMENTS.slice(0, 1)} onDone={() => {}} />,
  );
  expect(view.getByRole("status").querySelector("svg")).not.toBeNull();
  expect(view.getByText("First focus")).toBeTruthy();
});
