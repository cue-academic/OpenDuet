import { expect, test } from "bun:test";
import { coachFormat, coachParts, validCoachTimeZone } from "@/lib/coach/clock";
import { addDays, localDate, startOfDay } from "@/lib/coach/model";
import {
  minutesOn,
  todaysCheckIn,
  streak,
  minutesToBedtime,
  weeklyReport,
} from "@/lib/coach/progress";
import { blankState } from "@/lib/coach/seed";

test("a known calendar timezone overrides the browser for Coach labels, hours and day keys", () => {
  const now = new Date("2026-11-22T22:35:00-06:00");
  const timeZone = validCoachTimeZone("America/Chicago");
  const state = { ...blankState("Jordan"), timeZone };
  state.sessions = [
    {
      id: "evening",
      assignmentId: null,
      startedAt: now.toISOString(),
      minutes: 25,
    },
  ];
  state.checkIns = [{ date: "2026-11-22", mood: 4, energy: 3, sleepHours: 7 }];
  expect(
    coachFormat(
      now,
      { weekday: "long", month: "long", day: "numeric" },
      timeZone,
    ),
  ).toBe("Sunday, November 22");
  expect(coachParts(now, timeZone).hour).toBe(22);
  expect(localDate(now, timeZone)).toBe("2026-11-22");
  expect(minutesOn(state, now)).toBe(25);
  expect(todaysCheckIn(state, now)?.date).toBe("2026-11-22");
  expect(streak(state, now)).toEqual({ days: 1, todayDone: true });
  expect(weeklyReport(state, now).totalMin).toBe(25);
  expect(minutesToBedtime("22:30", now, timeZone)).toBe(-5);
  expect(localDate(startOfDay(now, timeZone), timeZone)).toBe("2026-11-22");
});

test("missing and unsupported calendar zones fall back to the browser zone", () => {
  const now = new Date("2026-11-23T04:35:00Z");
  for (const zone of [undefined, "not/a-timezone"]) {
    const timeZone = validCoachTimeZone(zone);
    expect(timeZone).toBeUndefined();
    expect(coachParts(now, timeZone).hour).toBe(now.getHours());
    expect(coachFormat(now, { weekday: "long" }, timeZone)).toBe(
      now.toLocaleDateString("en-US", { weekday: "long" }),
    );
  }
  const state = { ...blankState("Jordan"), timeZone: "America/Chicago" };
  expect(minutesOn(state, now)).toBe(0);
  expect(todaysCheckIn(state, now)).toBeUndefined();
});

test("calendar day arithmetic crosses DST without drifting the local day or hour", () => {
  const timeZone = "America/Chicago";
  const before = new Date("2026-03-07T12:00:00-06:00");
  const after = addDays(before, 1, timeZone);
  expect(localDate(after, timeZone)).toBe("2026-03-08");
  expect(coachParts(after, timeZone).hour).toBe(12);
  expect(after.getTime() - before.getTime()).toBe(23 * 60 * 60_000);
  expect(startOfDay(after, timeZone).toISOString()).toBe(
    "2026-03-08T06:00:00.000Z",
  );
});

for (const [timeZone, instant, today, hour] of [
  ["America/Chicago", "2026-11-22T22:35:00-06:00", "2026-11-22", 22],
  ["Pacific/Auckland", "2026-11-23T00:35:00+13:00", "2026-11-23", 0],
  ["America/Chicago", "2026-03-08T23:35:00-05:00", "2026-03-08", 23],
] as const) {
  test(`Coach and first-day date keys use the local day in ${timeZone} at ${instant}`, () => {
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        "-e",
        `
          import { localDate, formatDue } from ${JSON.stringify(new URL("../src/lib/coach/model.ts", import.meta.url).pathname)};
          import { localDateOf } from ${JSON.stringify(new URL("../../shared/morning-brief.ts", import.meta.url).pathname)};
          import { minutesOn, todaysCheckIn } from ${JSON.stringify(new URL("../src/lib/coach/progress.ts", import.meta.url).pathname)};
          import { demoState } from ${JSON.stringify(new URL("../src/lib/coach/seed.ts", import.meta.url).pathname)};
          const now = new Date(${JSON.stringify(instant)});
          const state = demoState(now);
          state.sessions = [{ id: "evening", assignmentId: null, startedAt: now.toISOString(), minutes: 25 }];
          state.checkIns = [{ date: ${JSON.stringify(today)}, mood: 4, energy: 3, sleep: 2 }];
          console.log(JSON.stringify({
            day: localDate(now), firstDay: localDateOf(now), hour: now.getHours(),
            due: formatDue(now.toISOString(), now), minutes: minutesOn(state, now),
            checkIn: todaysCheckIn(state, now)?.date,
          }));
        `,
      ],
      env: { ...process.env, TZ: timeZone },
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual({
      day: today,
      firstDay: today,
      hour,
      due: "today",
      minutes: 25,
      checkIn: today,
    });
  });
}
