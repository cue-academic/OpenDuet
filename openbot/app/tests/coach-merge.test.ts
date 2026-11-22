import { describe, expect, test } from "bun:test";
import { mergeCoach } from "../src/lib/coach/merge";
import type { CoachState } from "../src/lib/coach/model";
import { demoState } from "../src/lib/coach/seed";

const NOW = new Date(2026, 10, 4, 16, 0);
const base = (): CoachState => demoState(NOW);
const edit = (change: (state: CoachState) => void): CoachState => {
  const state = structuredClone(base());
  change(state);
  return state;
};

describe("mergeCoach", () => {
  test("no change on either side is the same state", () => {
    expect(mergeCoach(base(), base(), base())).toEqual(base());
  });

  test("keeps a check-in from each device", () => {
    const mine = edit((s) => {
      s.checkIns.push({
        date: "2026-11-04",
        mood: 4,
        energy: 3,
        sleepHours: 8,
      });
    });
    const theirs = edit((s) => {
      s.checkIns.push({
        date: "2026-11-03",
        mood: 2,
        energy: 2,
        sleepHours: 6,
      });
    });
    const dates = mergeCoach(base(), mine, theirs).checkIns.map((c) => c.date);
    expect(dates).toContain("2026-11-04");
    expect(dates).toContain("2026-11-03");
    expect(dates).toHaveLength(base().checkIns.length + 2);
  });

  test("the same day's check-in on both devices keeps this one's", () => {
    const mine = edit((s) => {
      s.checkIns.push({
        date: "2026-11-04",
        mood: 5,
        energy: 5,
        sleepHours: 9,
      });
    });
    const theirs = edit((s) => {
      s.checkIns.push({
        date: "2026-11-04",
        mood: 1,
        energy: 1,
        sleepHours: 4,
      });
    });
    const merged = mergeCoach(base(), mine, theirs).checkIns;
    expect(merged.filter((c) => c.date === "2026-11-04")).toEqual([
      { date: "2026-11-04", mood: 5, energy: 5, sleepHours: 9 },
    ]);
  });

  test("focus logged on both devices adds up", () => {
    const id = base().assignments[0].id;
    const was = base().assignments[0].spentMin;
    const log = (sessionId: string, minutes: number) =>
      edit((s) => {
        s.sessions.push({
          id: sessionId,
          assignmentId: id,
          startedAt: NOW.toISOString(),
          minutes,
        });
        s.assignments[0].spentMin += minutes;
      });
    const merged = mergeCoach(base(), log("mine", 25), log("theirs", 10));
    expect(merged.assignments[0].spentMin).toBe(was + 35);
    expect(merged.sessions.map((s) => s.id)).toEqual(
      expect.arrayContaining(["mine", "theirs"]),
    );
  });

  test("different fields of one assignment both stick", () => {
    const mine = edit((s) => {
      s.assignments[0].status = "done";
    });
    const theirs = edit((s) => {
      s.assignments[0].title = "Renamed on the laptop";
      s.profile.dailyGoalMin = 90;
    });
    const merged = mergeCoach(base(), mine, theirs);
    expect(merged.assignments[0].status).toBe("done");
    expect(merged.assignments[0].title).toBe("Renamed on the laptop");
    expect(merged.profile.dailyGoalMin).toBe(90);
  });

  test("an assignment removed here stays removed, one added there arrives", () => {
    const gone = base().assignments[0].id;
    const mine = edit((s) => {
      s.assignments.shift();
    });
    const theirs = edit((s) => {
      s.assignments.push({ ...s.assignments[1], id: "new-there" });
    });
    const ids = mergeCoach(base(), mine, theirs).assignments.map((a) => a.id);
    expect(ids).not.toContain(gone);
    expect(ids).toContain("new-there");
  });

  test("a badge earned on both keeps the earlier time", () => {
    const mine = edit((s) => {
      s.unlocked.x = "2026-11-04T10:00:00.000Z";
    });
    const theirs = edit((s) => {
      s.unlocked.x = "2026-11-03T10:00:00.000Z";
      s.unlocked.y = "2026-11-03T11:00:00.000Z";
    });
    const merged = mergeCoach(base(), mine, theirs);
    expect(merged.unlocked.x).toBe("2026-11-03T10:00:00.000Z");
    expect(merged.unlocked.y).toBe("2026-11-03T11:00:00.000Z");
  });
});
