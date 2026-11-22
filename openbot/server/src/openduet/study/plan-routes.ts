import {
  type BlockAnswer,
  type CalendarDeadline,
  type CalendarView,
  type HelpLevel,
  MISSED_LOOKBACK_DAYS,
  type MissedBlock,
  type StudyBlock,
  type StudyPlan,
} from "@openbot/shared/study";
import { Hono } from "hono";
import type { AppVariables } from "../../auth/guards";
import {
  loadEnabledPack,
  packCalendarSlice,
  privateDemoSummary,
  schoolGreeting,
} from "../private-pack";
import { readCalendar } from "./calendar-source";
import {
  StudyConflictError,
  type StudyContext,
  StudyInputError,
  StudyNotFoundError,
  type StudyRecord,
  type StudyRouteDeps,
} from "./contracts";
import {
  appliedPlans,
  busyFrom,
  isStale,
  planFromRecord,
  planSpan,
} from "./plans";
import { studyContextOf } from "./routes";
import {
  checkApply,
  DEFAULT_CLASS_BUFFER_MIN,
  defaultAvailability,
  MOVE_DAYS,
  moveBlock,
  PASSED,
} from "./scheduler";
import { addDays, isDate, isTimeZone, zonedInstant, zonedParts } from "./time";

/*
 * A study plan the plan tool proposed (plan-tools.ts), its Apply, its Not now and its Remove (off
 * the calendar again, once applied), and the calendar the Calendar tab draws: the student's Google
 * Calendar, the study blocks they applied and what is due, for a run of their own days.
 *
 * An applied block that ended without being marked done was missed. The calendar lists those, and
 * Move puts one at the next free time (scheduler.ts moveBlock), checked against the calendar as it
 * is at that moment, the same as Apply. Done says the student did it, so it is not missed.
 *
 * Apply is the only way a plan reaches the calendar, and it checks the plan against the calendar as
 * it is at that moment, not as it was when the plan was made: a practice moved onto the evening, or
 * another plan applied in the meantime, is a refusal saying so, never a session on top of it.
 *
 * Mounted by routes.ts, which signs the person in, limits the body and turns the Study*Error classes
 * thrown here into answers. So this adds none of the three, and has no error handler of its own.
 */

const DISMISSED = "You dismissed this plan. Ask for a new one.";
const REMOVED = "You took this plan off your calendar. Ask for a new one.";
const CHANGED =
  "Your schedule changed since this plan was made. Ask for a fresh one.";
const NOTHING_FITS = "Nothing in this plan fits on your calendar.";
const ON_CALENDAR = "This plan is already on your calendar.";
const OFF_CALENDAR = "This session isn't on your calendar.";
const ALREADY_DONE = "You marked this session done.";
const NOT_STARTED = "This session hasn't started yet.";
const NO_ROOM = `There's no free time for this session in the next ${MOVE_DAYS} days. Ask for a fresh plan.`;

/** The most days the Calendar tab may ask for at once: two weeks, so a week view can look ahead. */
const MOST_CALENDAR_DAYS = 14;

/**
 * Each person's applies (and removals) one after another in this server, so two plans made from the
 * same calendar cannot both pass their checks before either lands. The store's row lock keeps one
 * plan from being applied twice; this keeps two plans from being applied over each other.
 */
function oneAtATime() {
  const running = new Map<string, Promise<void>>();
  return <T>(owner: string, work: () => Promise<T>): Promise<T> => {
    const result = (running.get(owner) ?? Promise.resolve()).then(work);
    const done = result.then(
      () => undefined,
      () => undefined,
    );
    running.set(owner, done);
    void done.then(() => {
      if (running.get(owner) === done) running.delete(owner);
    });
    return result;
  };
}

/** The first and last day a plan's blocks fall on. */
function daysOf(blocks: readonly StudyBlock[]): { from: string; to: string } {
  const dates = blocks.map((block) => block.date).sort();
  return { from: dates[0] ?? "", to: dates.at(-1) ?? "" };
}

function byTime(a: StudyBlock, b: StudyBlock): number {
  return (
    a.date.localeCompare(b.date) ||
    a.start.localeCompare(b.start) ||
    a.end.localeCompare(b.end) ||
    a.id.localeCompare(b.id)
  );
}

export function planRoutes(deps: StudyRouteDeps) {
  const clock = () => deps.now?.() ?? new Date();
  const applying = oneAtATime();

  async function recordOf(owner: string, id: string): Promise<StudyRecord> {
    const record = await deps.store.get(owner, "plan", id);
    if (!record) throw new StudyNotFoundError();
    return record;
  }

  /** The plan, with why it is stale when it is: the plans applied since it was made, or the clock. */
  async function current(
    owner: string,
    record: StudyRecord,
    now: Date,
  ): Promise<StudyPlan> {
    const plan = planFromRecord(record);
    if (plan.status !== "proposed") return plan;
    const since = await appliedPlans(
      deps.store,
      owner,
      new Date(plan.createdAt),
    );
    return planFromRecord(record, isStale(plan, since, now));
  }

  async function apply(
    owner: string,
    id: string,
    study: StudyContext,
  ): Promise<StudyPlan> {
    const now = clock();
    const record = await recordOf(owner, id);
    const plan = await current(owner, record, now);
    if (plan.status === "applied") return plan;
    if (plan.status === "discarded")
      throw new StudyConflictError(plan.appliedAt ? REMOVED : DISMISSED);
    // Said as what happened: a session that has begun is time passing, not the schedule changing.
    if (plan.stale)
      throw new StudyConflictError(
        plan.staleReason === "started" ? PASSED : CHANGED,
      );
    if (plan.blocks.length === 0) throw new StudyConflictError(NOTHING_FITS);

    // Google first, outside any transaction: a row lock is never held across a network call.
    const days = daysOf(plan.blocks);
    const calendar = await readCalendar(deps.callTool, study, days, {
      timeZone: plan.timeZone,
    });
    // A calendar that could not be read cannot show a clash, so nothing is added on a guess.
    const [unread] = calendar.couldNotRead;
    if (unread)
      throw new StudyConflictError(
        `${unread} Nothing was added to your calendar.`,
      );
    const others = (
      await appliedPlans(
        deps.store,
        owner,
        zonedInstant(days.from, "00:00", plan.timeZone),
        zonedInstant(days.to, "24:00", plan.timeZone),
      )
    ).filter((other) => other.id !== plan.id);
    const { date: today, minute: nowMinute } = zonedParts(now, plan.timeZone);
    const clash = checkApply({
      today,
      nowMinute,
      blocks: plan.blocks,
      busy: busyFrom(calendar.events, others),
    });
    if (clash) throw new StudyConflictError(clash);

    const saved = await deps.store.update(owner, "plan", id, (stored) => {
      // Applied meanwhile, in another tab: the same answer, and nothing to write.
      if (stored.status === "applied") return {};
      if (stored.status !== "proposed") throw new StudyConflictError(DISMISSED);
      return {
        status: "applied",
        // Stamped as it lands, after the calendar read, so a plan made during that read is stale.
        data: {
          ...stored.data,
          status: "applied",
          appliedAt: clock().toISOString(),
        },
      };
    });
    return planFromRecord(saved);
  }

  /**
   * Takes a plan off the calendar, or out of the way if it never got there. An applied plan becomes
   * "discarded", so its blocks stop being busy time, covered minutes and calendar blocks, and keeps
   * its appliedAt, so the card can say it was on the calendar and was taken off; removedAt says when.
   * A plan already discarded answers as it is.
   */
  async function remove(owner: string, id: string): Promise<StudyPlan> {
    const saved = await deps.store.update(owner, "plan", id, (stored) => {
      if (stored.status === "discarded") return {};
      return {
        status: "discarded",
        data: {
          ...stored.data,
          status: "discarded",
          ...(stored.status === "applied"
            ? { removedAt: clock().toISOString() }
            : {}),
        },
      };
    });
    return planFromRecord(saved);
  }

  /** An applied plan and one of its blocks, or why there is nothing to act on. */
  function blockOf(
    record: StudyRecord,
    blockId: string,
  ): { plan: StudyPlan; block: StudyBlock } {
    const plan = planFromRecord(record);
    const block = plan.blocks.find((entry) => entry.id === blockId);
    if (!block) throw new StudyNotFoundError();
    if (plan.status !== "applied") throw new StudyConflictError(OFF_CALENDAR);
    return { plan, block };
  }

  /** Writes one block of an applied plan back, under the row lock, and answers with both. */
  async function writeBlock(
    owner: string,
    id: string,
    blockId: string,
    change: (block: StudyBlock, plan: StudyPlan) => StudyBlock,
  ): Promise<BlockAnswer> {
    const saved = await deps.store.update(owner, "plan", id, (stored) => {
      const { plan, block } = blockOf(stored, blockId);
      const blocks = plan.blocks
        .map((entry) => (entry.id === blockId ? change(block, plan) : entry))
        .sort(byTime);
      return {
        ...planSpan(blocks, plan.timeZone),
        data: { ...stored.data, blocks },
      };
    });
    const plan = planFromRecord(saved);
    const block = plan.blocks.find((entry) => entry.id === blockId);
    if (!block) throw new StudyNotFoundError();
    return { plan, block };
  }

  /**
   * Moves a block of an applied plan to the next free time: after now, inside the study hours,
   * clear of the calendar and every other applied block. A block that has not ended yet moves to
   * the next free time after it, for the evening the student already knows is gone.
   */
  async function move(
    owner: string,
    id: string,
    blockId: string,
    study: StudyContext,
  ): Promise<BlockAnswer> {
    const now = clock();
    const { plan, block } = blockOf(await recordOf(owner, id), blockId);
    if (block.done) throw new StudyConflictError(ALREADY_DONE);
    const { timeZone } = plan;
    const { date: today, minute: nowMinute } = zonedParts(now, timeZone);
    const days = { from: today, to: addDays(today, MOVE_DAYS - 1) };

    // Google first, outside any transaction, as Apply reads it.
    const calendar = await readCalendar(deps.callTool, study, days, {
      timeZone,
    });
    const [unread] = calendar.couldNotRead;
    if (unread) throw new StudyConflictError(`${unread} Nothing was moved.`);
    const applied = await appliedPlans(
      deps.store,
      owner,
      zonedInstant(days.from, "00:00", timeZone),
      zonedInstant(days.to, "24:00", timeZone),
    );
    // The deadline as the classes have it now. Unread, the block keeps the lateness it had.
    const { snapshot } = await deps.school.current(study);
    const assignment = snapshot?.assignments.find(
      (entry) => entry.id === block.assignmentId,
    );
    const moved = moveBlock({
      today,
      nowMinute,
      block,
      due: assignment?.dueDate ?? null,
      dueTime: assignment?.dueTime ?? null,
      busy: busyFrom(calendar.events, applied),
      availability: defaultAvailability,
      classBufferMin: DEFAULT_CLASS_BUFFER_MIN,
    });
    if (!moved) throw new StudyConflictError(NO_ROOM);
    return writeBlock(owner, id, blockId, (current) => {
      // Moved or done meanwhile, in another tab: it is not where this move found it.
      if (current.done) throw new StudyConflictError(ALREADY_DONE);
      if (
        current.date !== block.date ||
        current.start !== block.start ||
        current.end !== block.end
      )
        throw new StudyConflictError(CHANGED);
      return moved;
    });
  }

  /** The person's applied blocks that ended in the last week without being marked done. */
  async function missedBlocks(
    owner: string,
    now: Date,
    timeZone: string,
  ): Promise<MissedBlock[]> {
    const { date: today } = zonedParts(now, timeZone);
    const since = zonedInstant(
      addDays(today, -MISSED_LOOKBACK_DAYS),
      "00:00",
      timeZone,
    );
    const plans = await appliedPlans(deps.store, owner, since, now);
    const missed = new Map<string, MissedBlock>();
    for (const plan of plans)
      for (const block of plan.blocks) {
        if (block.done || missed.has(block.id)) continue;
        const ended = zonedInstant(block.date, block.end, plan.timeZone);
        if (since <= ended && ended <= now)
          missed.set(block.id, { planId: plan.id, block });
      }
    return [...missed.values()].sort((a, b) => byTime(a.block, b.block));
  }

  return new Hono<{ Variables: AppVariables }>()
    .get("/plans/:id", async (context) => {
      const owner = context.var.actor.id;
      const record = await recordOf(owner, context.req.param("id"));
      return context.json({ plan: await current(owner, record, clock()) });
    })
    .post("/plans/:id/apply", async (context) => {
      const owner = context.var.actor.id;
      const id = context.req.param("id");
      const study = studyContextOf(context, deps);
      const plan = await applying(owner, () => apply(owner, id, study));
      return context.json({ plan });
    })
    .post("/plans/:id/discard", async (context) => {
      const owner = context.var.actor.id;
      const saved = await deps.store.update(
        owner,
        "plan",
        context.req.param("id"),
        (stored) => {
          if (stored.status === "applied")
            throw new StudyConflictError(ON_CALENDAR);
          if (stored.status === "discarded") return {};
          return {
            status: "discarded",
            data: { ...stored.data, status: "discarded" },
          };
        },
      );
      return context.json({ plan: planFromRecord(saved) });
    })
    .post("/plans/:id/remove", async (context) => {
      const owner = context.var.actor.id;
      const id = context.req.param("id");
      const plan = await applying(owner, () => remove(owner, id));
      return context.json({ plan });
    })
    .post("/plans/:id/blocks/:blockId/move", async (context) => {
      const owner = context.var.actor.id;
      const { id, blockId } = context.req.param();
      const study = studyContextOf(context, deps);
      const answer = await applying(owner, () =>
        move(owner, id, blockId, study),
      );
      return context.json({ answer });
    })
    .post("/plans/:id/blocks/:blockId/done", async (context) => {
      const owner = context.var.actor.id;
      const { id, blockId } = context.req.param();
      const now = clock();
      const answer = await applying(owner, () =>
        writeBlock(owner, id, blockId, (block, plan) => {
          // Done is said of time spent: a session still ahead has nothing to mark.
          if (zonedInstant(block.date, block.start, plan.timeZone) > now)
            throw new StudyConflictError(NOT_STARTED);
          return { ...block, done: true };
        }),
      );
      return context.json({ answer });
    })
    .get("/private-demo", (context) => {
      const pack = loadEnabledPack();
      if (!pack) return context.json({ available: false });
      const studentName = process.env.ACADEMIC_OS_STUDENT_NAME?.trim() || null;
      return context.json({
        ...privateDemoSummary(pack),
        studentName,
        greeting: schoolGreeting(pack, clock(), studentName),
      });
    })
    .get("/calendar", async (context) => {
      const from = context.req.query("from") ?? "";
      const to = context.req.query("to") ?? "";
      if (!isDate(from) || !isDate(to))
        throw new StudyInputError(
          "Choose the days to show, written as YYYY-MM-DD.",
        );
      if (from > to)
        throw new StudyInputError(
          "Choose a first day that comes before the last one.",
        );
      if (addDays(from, MOST_CALENDAR_DAYS - 1) < to)
        throw new StudyInputError(
          `Show at most ${MOST_CALENDAR_DAYS} days at a time.`,
        );

      const owner = context.var.actor.id;
      const study = studyContextOf(context, deps);
      const now = clock();
      const { snapshot, why } = await deps.school.current(study);
      const calendar = await readCalendar(
        deps.callTool,
        study,
        { from, to },
        {
          ...(snapshot && isTimeZone(snapshot.timeZone)
            ? { timeZone: snapshot.timeZone }
            : {}),
          classes: snapshot?.classes ?? [],
        },
      );
      const { timeZone } = calendar;
      const { date: today, minute: nowMinute } = zonedParts(now, timeZone);

      // The level each assignment's study tools obey, as the Teacher rules screen shows it.
      const levels = new Map<string, HelpLevel>();
      if (snapshot) {
        const rules = await deps.rules.view(owner, snapshot, {
          canLoosen: false,
          now,
        });
        for (const schoolClass of rules.classes)
          for (const assignment of schoolClass.assignments)
            levels.set(assignment.assignmentId, assignment.level);
      }
      const deadlines: CalendarDeadline[] = (snapshot?.assignments ?? [])
        .flatMap((assignment) =>
          assignment.status !== "returned" &&
          assignment.dueDate !== null &&
          from <= assignment.dueDate &&
          assignment.dueDate <= to
            ? [
                {
                  assignmentId: assignment.id,
                  classId: assignment.classId,
                  title: assignment.title,
                  date: assignment.dueDate,
                  time: assignment.dueTime,
                  kind: assignment.kind,
                  help: levels.get(assignment.id) ?? null,
                },
              ]
            : [],
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
            a.title.localeCompare(b.title, "en"),
        );

      const applied = await appliedPlans(
        deps.store,
        owner,
        zonedInstant(from, "00:00", timeZone),
        zonedInstant(to, "24:00", timeZone),
      );
      const blocks = new Map<string, StudyBlock>();
      for (const plan of applied)
        for (const block of plan.blocks)
          if (from <= block.date && block.date <= to && !blocks.has(block.id))
            blocks.set(block.id, block);

      const view: CalendarView = {
        timeZone,
        today,
        nowMinute,
        from,
        to,
        classes: snapshot?.classes ?? [],
        events: calendar.events,
        allDay: calendar.allDay,
        blocks: [...blocks.values()].sort(byTime),
        missed: await missedBlocks(owner, now, timeZone),
        deadlines,
        couldNotRead: [
          ...new Set([
            ...(why ? [why] : []),
            ...(snapshot?.couldNotRead ?? []),
            ...calendar.couldNotRead,
          ]),
        ],
      };
      // Google isn't connected. A local school pack, when the demo asked for
      // one, is the calendar until a real account is.
      const pack = loadEnabledPack();
      if (
        pack &&
        view.events.length === 0 &&
        view.allDay.length === 0 &&
        view.couldNotRead.length > 0
      ) {
        const local = packCalendarSlice(pack, from, to, now);
        view.timeZone = local.timeZone;
        view.today = local.today;
        view.nowMinute = local.nowMinute;
        view.classes = local.classes;
        view.events = local.events;
        view.allDay = local.allDay;
        view.deadlines = local.deadlines;
        view.couldNotRead = [];
      }
      return context.json({ calendar: view });
    });
}
