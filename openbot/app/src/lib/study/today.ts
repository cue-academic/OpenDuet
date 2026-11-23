import type { CalendarView, SchoolHub } from "@openbot/shared/study";

type AgendaItem = {
  id: string;
  title: string;
  kind: "Event" | "Study block";
  start?: string;
  end?: string;
  done?: boolean;
};

export function dailyAgenda(
  calendar: CalendarView,
  day: string,
  minute: number,
) {
  const items: AgendaItem[] = [
    ...calendar.allDay
      .filter((event) => event.date === day)
      .map((event) => ({
        ...event,
        id: `all-day:${event.id}`,
        kind: "Event" as const,
      })),
    ...calendar.events
      .filter((event) => event.date === day)
      .map((event) => ({
        ...event,
        id: `event:${event.id}`,
        kind: "Event" as const,
      })),
    ...calendar.blocks
      .filter((block) => block.date === day)
      .map((block) => ({
        ...block,
        id: `block:${block.id}`,
        kind: "Study block" as const,
      })),
  ];
  items.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const next = items.find((item) => !item.done && item.end && item.end > clock);
  return { items, next };
}

export function nextDeadline(hub: SchoolHub, now: Date) {
  return hub.classes
    .flatMap((course) =>
      course.assignments.flatMap((assignment) => {
        if (
          !assignment.due ||
          assignment.status === "returned" ||
          assignment.kind === "announcement" ||
          assignment.kind === "material"
        ) {
          return [];
        }
        const due = new Date(assignment.due);
        return due >= now ? [{ assignment, course, due }] : [];
      }),
    )
    .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
}

/** Date-only values in the same zone. A DST change doesn't shorten a school day. */
export function daysUntil(today: string, deadline: string) {
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
}
