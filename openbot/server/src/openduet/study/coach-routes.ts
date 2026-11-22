import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../../auth/guards";
import {
  StudyInputError,
  type StudyRecord,
  type StudyRouteDeps,
} from "./contracts";

/*
 * The Coach tab's state on the server: the student's planner profile, check-ins, focus sessions,
 * assignments and badges, as one record per person (kind "coach"). The browser used to be the only
 * place it lived, so a second device started over and nothing else could read a streak.
 *
 *   GET /coach   { coach: { state, revision } }          state is null until the first save
 *   PUT /coach   { coach: { state, revision }, saved }   { state, revision } in; revision is the one
 *                                                        the browser last saw, null for a first save
 *
 * A save names the revision it was made on. When the stored one has moved (another device saved
 * first), nothing is written and the answer carries the stored copy with `saved: false`, so the
 * browser can take it. Mounted by routes.ts, which signs the person in and maps the errors.
 */

/** Bigger than a school year of daily use, and small enough to stay one cheap record. */
const MAX_CLASSES = 40;
const MAX_ASSIGNMENTS = 500;
const MAX_SESSIONS = 2000;
const MAX_CHECK_INS = 800;
const MAX_UNLOCKED = 100;

const CANT_READ = "Couldn't save your Coach changes. Reload the page.";
const PRIVATE_PACK =
  "A school pack stays on this computer. It isn't saved to your account.";

const id = z.string().min(1).max(128);
const text = z.string().max(300);
const time = z.string().max(40);
const minutes = z.number().finite().min(0).max(100_000);

const stateSchema = z
  .object({
    version: z.literal(1),
    demo: z.boolean(),
    source: z.enum(["sample", "private"]).optional(),
    profile: z
      .object({
        name: z.string().max(120),
        dailyGoalMin: minutes,
        bedtime: z.string().max(5),
        dailyCapacityMin: minutes,
        setupDone: z.boolean(),
      })
      .strict(),
    classes: z
      .array(
        z
          .object({
            id,
            name: text,
            teacher: text,
            color: z.enum([
              "violet",
              "blue",
              "green",
              "amber",
              "red",
              "accent",
            ]),
          })
          .strict(),
      )
      .max(MAX_CLASSES),
    assignments: z
      .array(
        z
          .object({
            id,
            classId: id,
            title: text,
            dueAt: time,
            points: z.number().finite().nullable(),
            estimateMin: minutes,
            spentMin: minutes,
            helpLevel: z.enum(["full", "hints", "none"]),
            status: z.enum(["todo", "doing", "done"]),
            doneAt: time.nullable(),
            lateCredit: z.number().min(0).max(1).nullable(),
            source: z.string().max(2000).nullable(),
          })
          .strict(),
      )
      .max(MAX_ASSIGNMENTS),
    sessions: z
      .array(
        z
          .object({
            id,
            assignmentId: id.nullable(),
            startedAt: time,
            minutes,
          })
          .strict(),
      )
      .max(MAX_SESSIONS),
    checkIns: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            mood: z.number().min(1).max(5),
            energy: z.number().min(1).max(5),
            sleepHours: z.number().min(0).max(24),
          })
          .strict(),
      )
      .max(MAX_CHECK_INS),
    unlocked: z
      .record(id, time)
      .refine((entries) => Object.keys(entries).length <= MAX_UNLOCKED),
  })
  .strict();

export type StoredCoachState = z.output<typeof stateSchema>;

const saveSchema = z
  .object({
    state: stateSchema,
    revision: z.number().int().min(1).nullable(),
  })
  .strict();

/** One record per person. The owner is in the id because ids are unique across owners. */
export const coachRecordId = (owner: string) => `coach:${owner}`;

type Coach = { state: StoredCoachState | null; revision: number | null };

function coachOf(record: StudyRecord | null): Coach {
  if (!record) return { state: null, revision: null };
  const state = stateSchema.safeParse(record.data.state);
  const revision = record.data.revision;
  // A record that can't be read is treated as none, so the next save replaces it.
  if (!state.success || typeof revision !== "number")
    return { state: null, revision: null };
  return { state: state.data, revision };
}

export function coachRoutes(deps: Pick<StudyRouteDeps, "store">) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const owner = (context: Context<{ Variables: AppVariables }>) =>
    context.var.actor.id;

  routes.get("/coach", async (context) => {
    const actor = owner(context);
    const record = await deps.store.get(actor, "coach", coachRecordId(actor));
    return context.json({ coach: coachOf(record) });
  });

  routes.put("/coach", async (context) => {
    const actor = owner(context);
    const parsed = saveSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) throw new StudyInputError(CANT_READ);
    const { state, revision } = parsed.data;
    if (state.source === "private") throw new StudyInputError(PRIVATE_PACK);

    const recordId = coachRecordId(actor);
    const first = { state, revision: 1 };
    const { record, created } = await deps.store.insertOnce(actor, {
      id: recordId,
      kind: "coach",
      data: first,
    });
    if (created) return context.json({ coach: first, saved: true });
    // An unreadable record has no revision, so any save replaces it.
    if (coachOf(record).revision === null) {
      await deps.store.put(actor, { id: recordId, kind: "coach", data: first });
      return context.json({ coach: first, saved: true });
    }

    let saved = false;
    // Under the row lock, so two devices saving on the same revision can't both win.
    const after = await deps.store.update(
      actor,
      "coach",
      recordId,
      (current) => {
        const stored = coachOf(current);
        if (revision === null || stored.revision !== revision) return {};
        saved = true;
        return { data: { state, revision: revision + 1 } };
      },
    );
    return context.json({ coach: coachOf(after), saved });
  });

  return routes;
}
