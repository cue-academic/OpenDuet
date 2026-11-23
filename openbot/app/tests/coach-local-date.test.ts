import { expect, test } from "bun:test";

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
