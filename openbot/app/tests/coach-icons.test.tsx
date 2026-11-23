import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup, render } from "@testing-library/react";
import { AchievementsCard, Celebration } from "@/components/coach/week";
import { ACHIEVEMENTS } from "@/lib/coach/progress";
import { demoState } from "@/lib/coach/seed";

beforeAll(() => GlobalRegistrator.register());
afterEach(cleanup);
afterAll(() => GlobalRegistrator.unregister());

test("each named badge uses an SVG, including badges not yet earned", () => {
  const state = demoState(new Date());
  state.unlocked = {};
  const view = render(<AchievementsCard state={state} />);
  expect(view.getAllByRole("listitem")).toHaveLength(10);
  for (const achievement of ACHIEVEMENTS) {
    const badge = view.getByRole("listitem", {
      name: `${achievement.title}: ${achievement.description}`,
    });
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  }
  expect(view.container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
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
