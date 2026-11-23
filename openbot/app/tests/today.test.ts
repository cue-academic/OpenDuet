import { expect, test } from "bun:test";
import type {
  CalendarView,
  HubAssignment,
  SchoolHub,
} from "@openbot/shared/study";
import { dailyAgenda, daysUntil, nextDeadline } from "@/lib/study/today";

const day = "2026-11-04";
const tomorrow = "2026-11-05";
const calendar: CalendarView = {
  today: day,
  nowMinute: 490,
  timeZone: "America/Chicago",
  from: day,
  to: tomorrow,
  classes: [],
  missed: [],
  deadlines: [],
  couldNotRead: [],
  allDay: [
    { id: "picture", title: "Picture day", date: day },
    { id: "fair", title: "Science fair", date: tomorrow },
  ],
  events: [
    { id: "lab", title: "Lab", date: day, start: "11:00", end: "11:50" },
    {
      id: "history",
      title: "History",
      date: day,
      start: "08:30",
      end: "09:20",
    },
  ],
  blocks: [
    {
      id: "review",
      assignmentId: null,
      classId: null,
      title: "Review notes",
      date: day,
      start: "10:00",
      end: "10:30",
      done: true,
    },
  ],
};

test("shows the selected day in order and advances past ended or completed work", () => {
  const morning = dailyAgenda(calendar, day, 8 * 60);
  expect(morning.items.map((item) => item.title)).toEqual([
    "Picture day",
    "History",
    "Review notes",
    "Lab",
  ]);
  expect(morning.next?.title).toBe("History");
  expect(dailyAgenda(calendar, day, 9 * 60 + 19).next?.title).toBe("History");
  expect(dailyAgenda(calendar, day, 9 * 60 + 20).next?.title).toBe("Lab");
  expect(dailyAgenda(calendar, day, 12 * 60).next).toBeUndefined();
  expect(
    dailyAgenda(calendar, tomorrow, 0).items.map((item) => item.title),
  ).toEqual(["Science fair"]);
});

function assignment(
  title: string,
  due: string | null,
  extra?: Partial<Pick<HubAssignment, "kind" | "status">>,
): HubAssignment {
  return {
    id: title,
    title,
    due,
    kind: "assignment",
    status: "open",
    points: null,
    grade: null,
    link: null,
    minutes: 20,
    level: "hints",
    source: "default",
    ...extra,
  };
}

test("shows the nearest upcoming deadline for actionable work across classes", () => {
  const course = {
    id: "biology",
    name: "Biology",
    teacher: null,
    period: null,
    color: "slate",
    source: "default",
    level: "hints",
  } as const;
  const hub: SchoolHub = {
    timeZone: calendar.timeZone,
    syncedAt: null,
    couldNotRead: [],
    classes: [
      {
        ...course,
        assignments: [
          assignment("Lab report", "2026-11-05T15:00:00Z"),
          assignment("Returned", "2026-11-04T16:00:00Z", {
            status: "returned",
          }),
          assignment("Past due", "2026-11-03T16:00:00Z", { status: "missing" }),
          assignment("No deadline", null),
        ],
      },
      {
        ...course,
        id: "history",
        name: "History",
        assignments: [
          assignment("Reading", "2026-11-04T15:00:00Z", { kind: "material" }),
          assignment("Quiz", "2026-11-04T17:00:00Z", { kind: "quiz" }),
        ],
      },
    ],
  };
  const nearest = nextDeadline(hub, new Date("2026-11-04T14:00:00Z"));
  expect(nearest?.assignment.title).toBe("Quiz");
  expect(nearest?.course.name).toBe("History");
  expect(nextDeadline(hub, new Date("2026-11-06T14:00:00Z"))).toBeUndefined();
});

test("counts calendar days instead of 24-hour periods around time changes", () => {
  expect(daysUntil("2026-11-01", "2026-11-01")).toBe(0);
  expect(daysUntil("2026-11-01", "2026-11-02")).toBe(1);
  expect(daysUntil("2026-10-31", "2026-11-03")).toBe(3);
});
