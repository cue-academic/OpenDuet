import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { SchoolHub } from "@openbot/shared/study";
import { cleanup, render, within } from "@testing-library/react";
import { ClassesView, hubDueText } from "@/components/duet/study";

/**
 * The Classes page's body over the sample student's hub: each class with its teacher and level, each
 * piece of work with its due line and the level in force, late work marked, and the page before any
 * classes were read.
 */

/** Wednesday, November 4, 2026, 3:10 PM in Chicago. */
const NOW = new Date("2026-11-04T21:10:00.000Z");

beforeAll(() => {
  GlobalRegistrator.register({ url: "http://localhost:3010/classes" });
});
afterEach(cleanup);
afterAll(() => {
  GlobalRegistrator.unregister();
});

const HUB: SchoolHub = {
  timeZone: "America/Chicago",
  syncedAt: "2026-11-04T21:05:00.000Z",
  couldNotRead: [],
  classes: [
    {
      id: "apush1",
      name: "AP US History",
      teacher: "Mr. Grant",
      period: "Period 1",
      color: "rose",
      level: "none",
      source: "notice",
      assignments: [
        {
          id: "apush1-dbq3",
          title: "DBQ essay",
          kind: "assignment",
          status: "open",
          due: "2026-11-06T14:00:00.000Z",
          points: 50,
          grade: null,
          minutes: 120,
          link: null,
          level: "none",
          source: "notice",
        },
      ],
    },
    {
      id: "precalc4",
      name: "Precalculus",
      teacher: "Mr. Chen",
      period: "4",
      color: "sky",
      level: "full",
      source: "notice",
      assignments: [
        {
          id: "precalc4-hw43",
          title: "Section 4.3 homework",
          kind: "assignment",
          status: "missing",
          due: "2026-11-04T05:59:00.000Z",
          points: null,
          grade: null,
          minutes: 45,
          link: "https://classroom.example/hw43",
          level: "full",
          source: "notice",
        },
        {
          id: "precalc4-quiz4",
          title: "Unit 4 quiz",
          kind: "quiz",
          status: "open",
          due: "2026-11-05T16:45:00.000Z",
          points: null,
          grade: null,
          minutes: 60,
          link: null,
          level: "hints",
          source: "override",
        },
      ],
    },
  ],
};

function draw(hub: SchoolHub | null, loadError: string | null = null) {
  return render(
    <ClassesView
      connections={({ className, children }) => (
        <a className={className} href="/connections">
          {children}
        </a>
      )}
      hub={hub}
      loadError={loadError}
      now={NOW}
      onRefresh={() => {}}
      onReload={() => {}}
      refreshError={null}
      refreshing={false}
      rules={({ className, children }) => (
        <a className={className} href="/settings/teacher-rules">
          {children}
        </a>
      )}
    />,
  );
}

describe("ClassesView", () => {
  test("shows each class with its work, due dates and help level", () => {
    const view = draw(HUB);
    expect(view.getByText(/2 classes, 3 to do/)).toBeTruthy();
    expect(view.getByText("Mr. Grant · Period 1")).toBeTruthy();
    expect(view.getByText("Mr. Chen · Period 4")).toBeTruthy();

    const precalc = within(view.getByLabelText("Precalculus assignments"));
    const rows = precalc.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const [homework, quiz] = rows as [HTMLElement, HTMLElement];
    expect(
      within(homework).getByText(/Missing · was due Tue, Nov 3, 11:59/),
    ).toBeTruthy();
    expect(homework.querySelector("[data-help-level]")).toBeNull();
    expect(
      within(homework).getByRole("link", { name: "Section 4.3 homework" }),
    ).toBeTruthy();
    expect(within(quiz).getByText(/Due tomorrow, 10:45/)).toBeTruthy();
    expect(within(quiz).getByText("Guided help")).toBeTruthy();
    expect(within(quiz).getByText(/Quiz · About 1.h/)).toBeTruthy();

    const apush = within(view.getByLabelText("AP US History assignments"));
    expect(apush.queryByText("On your own")).toBeNull();
    const headerRule = within(
      view.getByRole("region", { name: "AP US History" }),
    ).getByText("On your own");
    expect(headerRule.className).not.toMatch(/rounded|bg-/);
    expect(
      view.getByRole("heading", { name: "AP US History" }).className,
    ).toContain("study-display");
    expect(apush.getByText(/50 points/)).toBeTruthy();
  });

  test("says what to do before any classes were read", () => {
    const view = draw({
      timeZone: "UTC",
      syncedAt: null,
      classes: [],
      couldNotRead: [],
    });
    expect(view.getByText("Your classes haven't been read yet")).toBeTruthy();
    expect(view.getByRole("link", { name: "Open Connections" })).toBeTruthy();
  });

  test("shows a load failure with a way to try again", () => {
    const view = draw(null, "Couldn't load your classes.");
    expect(view.getByRole("alert").textContent).toBe(
      "Couldn't load your classes.",
    );
    expect(view.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("hubDueText", () => {
  test("says a returned grade and a missing date", () => {
    expect(
      hubDueText(
        { status: "returned", due: null, grade: "34/40" },
        NOW,
        "America/Chicago",
      ),
    ).toBe("Returned · 34/40");
    expect(
      hubDueText(
        { status: "open", due: null, grade: null },
        NOW,
        "America/Chicago",
      ),
    ).toBe("No due date");
  });
});
