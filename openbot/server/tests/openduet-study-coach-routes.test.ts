import { describe, expect, test } from "bun:test";
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { coachRecordId, coachRoutes } from "../src/openduet/study/coach-routes";
import { createMemoryStudyStore } from "../src/openduet/study/memory-store";
import { mountStudyRoutes } from "../src/openduet/study/routes";

const PATH = "/api/openduet/study";

function signedIn(
  userId: string,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    context.set("actor", {
      id: userId,
      email: `${userId}@example.com`,
      role: "user",
    });
    await next();
  };
}

/** Jordan Rivera's sample week, cut down to what the tests read. */
function jordan(checkIns = 1) {
  return {
    version: 1,
    demo: true,
    source: "sample",
    profile: {
      name: "Jordan",
      dailyGoalMin: 60,
      bedtime: "22:30",
      dailyCapacityMin: 150,
      setupDone: true,
    },
    classes: [
      { id: "chem", name: "Chemistry", teacher: "Ms. Okafor", color: "green" },
    ],
    assignments: [
      {
        id: "chem-lab6",
        classId: "chem",
        title: "Lab 6 report: Reaction Rates",
        dueAt: "2026-11-05T23:59:00.000Z",
        points: 50,
        estimateMin: 90,
        spentMin: 25,
        helpLevel: "hints",
        status: "doing",
        doneAt: null,
        lateCredit: 0.5,
        source: null,
      },
    ],
    sessions: [
      {
        id: "s1",
        assignmentId: "chem-lab6",
        startedAt: "2026-11-03T22:00:00.000Z",
        minutes: 25,
      },
    ],
    checkIns: Array.from({ length: checkIns }, (_, day) => ({
      date: `2026-11-${String(day + 1).padStart(2, "0")}`,
      mood: 4,
      energy: 3,
      sleepHours: 7.5,
    })),
    unlocked: { "first-focus": "2026-11-03T22:25:00.000Z" },
  };
}

function setup() {
  const store = createMemoryStudyStore();
  const as = (userId: string) => {
    const app = new Hono();
    app.route(
      PATH,
      mountStudyRoutes([coachRoutes({ store })], signedIn(userId)),
    );
    return async (method: "GET" | "PUT", body?: unknown) => {
      const response = await app.request(`${PATH}/coach`, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: typeof body === "string" ? body : JSON.stringify(body),
            }),
      });
      return {
        status: response.status,
        body: (await response.json()) as {
          coach?: {
            state: ReturnType<typeof jordan> | null;
            revision: number | null;
          };
          saved?: boolean;
          error?: string;
        },
      };
    };
  };
  return { store, as };
}

describe("coach state routes", () => {
  test("has nothing until the first save", async () => {
    const { as } = setup();
    const got = await as("jordan")("GET");
    expect(got.status).toBe(200);
    expect(got.body.coach).toEqual({ state: null, revision: null });
  });

  test("saves a week and reads it back", async () => {
    const { as } = setup();
    const put = await as("jordan")("PUT", { state: jordan(), revision: null });
    expect(put.status).toBe(200);
    expect(put.body.saved).toBe(true);
    expect(put.body.coach?.revision).toBe(1);
    const got = await as("jordan")("GET");
    expect(got.body.coach).toEqual({ state: jordan(), revision: 1 });
  });

  test("a later save on the current revision replaces it", async () => {
    const { as } = setup();
    const call = as("jordan");
    await call("PUT", { state: jordan(1), revision: null });
    const put = await call("PUT", { state: jordan(2), revision: 1 });
    expect(put.body.saved).toBe(true);
    expect(put.body.coach?.revision).toBe(2);
    expect((await call("GET")).body.coach?.state?.checkIns).toHaveLength(2);
  });

  test("a save made on an old revision changes nothing and gets the stored copy", async () => {
    const { as } = setup();
    const call = as("jordan");
    await call("PUT", { state: jordan(1), revision: null });
    await call("PUT", { state: jordan(2), revision: 1 });
    for (const revision of [1, null, 7]) {
      const stale = await call("PUT", { state: jordan(5), revision });
      expect(stale.status).toBe(200);
      expect(stale.body.saved).toBe(false);
      expect(stale.body.coach?.revision).toBe(2);
      expect(stale.body.coach?.state?.checkIns).toHaveLength(2);
    }
    expect((await call("GET")).body.coach?.revision).toBe(2);
  });

  test("each person has their own", async () => {
    const { as } = setup();
    await as("jordan")("PUT", { state: jordan(3), revision: null });
    expect((await as("sam")("GET")).body.coach).toEqual({
      state: null,
      revision: null,
    });
    const sam = await as("sam")("PUT", { state: jordan(1), revision: null });
    expect(sam.body.saved).toBe(true);
    expect(
      (await as("jordan")("GET")).body.coach?.state?.checkIns,
    ).toHaveLength(3);
    expect((await as("sam")("GET")).body.coach?.state?.checkIns).toHaveLength(
      1,
    );
  });

  test("refuses a state it can't read, and keeps what it had", async () => {
    const { as } = setup();
    const call = as("jordan");
    await call("PUT", { state: jordan(), revision: null });
    const bad: unknown[] = [
      "not json",
      {},
      { state: jordan() },
      { state: { ...jordan(), version: 2 }, revision: 1 },
      { state: { ...jordan(), extra: true }, revision: 1 },
      {
        state: { ...jordan(), checkIns: [{ date: "today", mood: 9 }] },
        revision: 1,
      },
      { state: jordan(), revision: "1" },
    ];
    for (const body of bad) {
      const put = await call("PUT", body);
      expect(put.status).toBe(400);
      expect(put.body.error).toBeString();
    }
    expect((await call("GET")).body.coach).toEqual({
      state: jordan(),
      revision: 1,
    });
  });

  test("never stores a school pack", async () => {
    const { as, store } = setup();
    const put = await as("jordan")("PUT", {
      state: { ...jordan(), source: "private" },
      revision: null,
    });
    expect(put.status).toBe(400);
    expect(
      await store.get("jordan", "coach", coachRecordId("jordan")),
    ).toBeNull();
  });

  test("takes a year of use, past the 32 KB the other study routes allow", async () => {
    const { as } = setup();
    const state = jordan(28);
    state.sessions = Array.from({ length: 1500 }, (_, n) => ({
      id: `session-${n}`,
      assignmentId: "chem-lab6",
      startedAt: "2026-11-03T22:00:00.000Z",
      minutes: 25,
    }));
    expect(JSON.stringify(state).length).toBeGreaterThan(32_768);
    const put = await as("jordan")("PUT", { state, revision: null });
    expect(put.status).toBe(200);
    expect(put.body.saved).toBe(true);
  });

  test("a stored record it can't read is replaced by the next save", async () => {
    const { as, store } = setup();
    await store.put("jordan", {
      id: coachRecordId("jordan"),
      kind: "coach",
      data: { state: { version: 0 } },
    });
    const call = as("jordan");
    expect((await call("GET")).body.coach).toEqual({
      state: null,
      revision: null,
    });
    const put = await call("PUT", { state: jordan(), revision: null });
    expect(put.body.saved).toBe(true);
    expect((await call("GET")).body.coach?.revision).toBe(1);
  });
});
