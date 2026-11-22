import { describe, expect, test } from "bun:test";
import type { StudyBlock } from "@openbot/shared/study";
import {
  type BusyEvent,
  type DayWindow,
  type MoveInput,
  moveBlock,
} from "../src/openduet/study/scheduler";

/*
 * A missed study block moved to the next free time: the first gap of its length in the study
 * hours, clear of the calendar and other sessions, within the week.
 */

const TODAY = "2026-11-04"; // a Wednesday
const HOURS: DayWindow = {
  enabled: true,
  start: "16:00",
  end: "21:00",
  cap: 120,
  focus: 45,
  rest: 10,
};

const BLOCK: StudyBlock = {
  id: "b1",
  assignmentId: "essay",
  classId: "eng",
  title: "English: essay",
  date: "2026-11-03",
  start: "17:00",
  end: "17:45",
};

function busy(
  id: string,
  date: string,
  start: string,
  end: string,
  kind: BusyEvent["kind"] = "commitment",
): BusyEvent {
  return { id, date, start, end, kind };
}

function move(overrides: Partial<MoveInput> = {}): string | null {
  const moved = moveBlock({
    today: TODAY,
    nowMinute: 14 * 60,
    block: BLOCK,
    due: null,
    dueTime: null,
    busy: [],
    availability: () => HOURS,
    classBufferMin: 10,
    ...overrides,
  });
  return moved
    ? `${moved.date} ${moved.start}-${moved.end}${moved.late ? " late" : ""}`
    : null;
}

describe("moving a study block", () => {
  test("goes to the start of today's study hours when they are free, keeping what it is", () => {
    expect(
      moveBlock({
        today: TODAY,
        nowMinute: 14 * 60,
        block: { ...BLOCK, done: false },
        due: null,
        dueTime: null,
        busy: [],
        availability: () => HOURS,
        classBufferMin: 10,
      }),
    ).toEqual({
      id: "b1",
      assignmentId: "essay",
      classId: "eng",
      title: "English: essay",
      date: TODAY,
      start: "16:00",
      end: "16:45",
      movedFrom: { date: "2026-11-03", start: "17:00", end: "17:45" },
    });
  });

  test("starts a few minutes from now, on a five-minute mark", () => {
    expect(move({ nowMinute: 16 * 60 + 12 })).toBe(`${TODAY} 16:20-17:05`);
  });

  test("keeps the buffer around a commitment and the rest around another session", () => {
    expect(
      move({
        busy: [
          busy("practice", TODAY, "15:30", "17:30"),
          busy("b2", TODAY, "17:50", "18:20", "study"),
        ],
      }),
    ).toBe(`${TODAY} 18:30-19:15`);
  });

  test("never clashes with its own old place", () => {
    expect(
      move({
        block: { ...BLOCK, date: TODAY, start: "16:00", end: "16:45" },
        nowMinute: 17 * 60,
        busy: [busy("b1", TODAY, "16:00", "16:45", "study")],
      }),
    ).toBe(`${TODAY} 17:05-17:50`);
  });

  test("goes to the next day when today is full, over its cap, or switched off", () => {
    expect(move({ busy: [busy("game", TODAY, "15:00", "20:30")] })).toBe(
      "2026-11-05 16:00-16:45",
    );
    expect(move({ busy: [busy("b2", TODAY, "19:00", "20:30", "study")] })).toBe(
      "2026-11-05 16:00-16:45",
    );
    expect(
      move({
        availability: (date) =>
          date === TODAY ? { ...HOURS, enabled: false } : HOURS,
      }),
    ).toBe("2026-11-05 16:00-16:45");
  });

  test("a session still ahead moves to after where it was", () => {
    expect(
      move({
        block: { ...BLOCK, date: "2026-11-05", start: "16:00", end: "16:45" },
      }),
    ).toBe("2026-11-05 16:55-17:40");
  });

  test("is late once it lands after the deadline, and stays late when the deadline is unknown", () => {
    expect(move({ due: TODAY, dueTime: "17:00" })).toBe(`${TODAY} 16:00-16:45`);
    expect(move({ due: TODAY, dueTime: "16:30" })).toBe(
      `${TODAY} 16:00-16:45 late`,
    );
    expect(move({ due: "2026-11-03", dueTime: null })).toBe(
      `${TODAY} 16:00-16:45 late`,
    );
    expect(move({ block: { ...BLOCK, late: true } })).toBe(
      `${TODAY} 16:00-16:45 late`,
    );
    expect(move({ block: { ...BLOCK, late: true }, due: "2026-11-06" })).toBe(
      `${TODAY} 16:00-16:45`,
    );
  });

  test("is null when the week has no room", () => {
    expect(move({ availability: () => ({ ...HOURS, enabled: false }) })).toBe(
      null,
    );
    expect(move({ availability: () => ({ ...HOURS, cap: 30 }) })).toBe(null);
  });
});
