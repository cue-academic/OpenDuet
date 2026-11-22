import {
  ASSIGNMENTS_TOOL,
  type AssignmentKind,
  HELP_LEVEL_LABEL,
  type HubAssignment,
  type HubClass,
} from "@openbot/shared/study";
import type { GrantedTool } from "@openbot/toolkit/granted-tool";
import { z } from "zod";
import type { StudyContext, StudyToolDeps } from "./contracts";
import { schoolHub } from "./hub";
import { normaliseName } from "./rules";

/**
 * list_assignments: the student's stored classes and work, with each due date and the AI help level
 * in force, so the Bot answers "what's due?" from the database and not from a fresh search of mail.
 * It only reads, so a teacher's rule never pauses it.
 */

/** Work a student hands in or sits; a posted material or an announcement is neither. */
const GRADED: readonly AssignmentKind[] = ["assignment", "quiz", "test"];

const parameters = z.object({
  class: z
    .string()
    .optional()
    .describe("One class by name. Leave it out for every class."),
  include: z
    .enum(["todo", "all"])
    .optional()
    .describe(
      "todo (the default) is work still to hand in, missing work included. all adds returned work, materials and announcements.",
    ),
});

type Listed = {
  class: string;
  teacher: string | null;
  title: string;
  kind: AssignmentKind;
  status: HubAssignment["status"];
  due: string | null;
  /** The due date and time in the student's own time zone, ready to say. */
  dueLocal: string | null;
  overdue: boolean;
  points: number | null;
  grade: string | null;
  minutes: number;
  helpLevel: HubAssignment["level"];
  help: string;
  helpSetBy: HubAssignment["source"];
};

function localText(due: string | null, timeZone: string): string | null {
  if (due === null) return null;
  const at = new Date(due);
  if (Number.isNaN(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(at);
  } catch {
    return null;
  }
}

/** Soonest due first across classes; work with no due date last, then by title. */
function byDue(left: Listed, right: Listed): number {
  if (left.due === right.due) return left.title.localeCompare(right.title);
  if (left.due === null) return 1;
  if (right.due === null) return -1;
  return left.due < right.due ? -1 : 1;
}

export function hubTools(deps: StudyToolDeps): GrantedTool[] {
  const context: StudyContext = {
    actorId: deps.actorId,
    botId: deps.botId,
    initiator: deps.initiator,
  };
  const now = () => deps.now?.() ?? new Date();
  return [
    {
      name: ASSIGNMENTS_TOOL,
      ref: `openduet/${ASSIGNMENTS_TOOL}`,
      description: [
        "List the student's classes and assignments as stored from their Classroom notices: each title, class, due date, status, points and the AI help level in force for it.",
        "Call it when they ask what is due, what is missing, what a class has coming up, or before planning or helping with an assignment. Give the class to see one class.",
        "Say due dates from dueLocal. The help level is the teacher's rule for that assignment: obey it.",
      ].join(" "),
      parameters,
      initiator: deps.initiator,
      async execute(args: unknown) {
        const checked = parameters.safeParse(blankless(args));
        if (!checked.success)
          return JSON.stringify({
            error: "Give class as a class name, and include as todo or all.",
          });
        const read = await deps.school.current(context);
        const instant = now();
        const hub = schoolHub(
          read.snapshot,
          await deps.rules.view(deps.actorId, read.snapshot, {
            canLoosen: false,
            now: instant,
            couldNotRead: read.why ? [read.why] : [],
          }),
        );
        if (!read.snapshot)
          return JSON.stringify({
            error:
              read.why ??
              "No classes are stored yet. Ask the student to connect Gmail so their Classroom notices can be read.",
          });
        let classes: HubClass[] = hub.classes;
        const named = checked.data.class;
        if (named !== undefined) {
          const wanted = normaliseName(named);
          const exact = classes.filter(
            (candidate) => normaliseName(candidate.name) === wanted,
          );
          const matches =
            exact.length > 0
              ? exact
              : classes.filter((candidate) =>
                  normaliseName(candidate.name).includes(wanted),
                );
          if (matches.length !== 1)
            return JSON.stringify({
              error:
                matches.length === 0
                  ? `"${named}" isn't one of the student's classes.`
                  : `"${named}" matches more than one of the student's classes.`,
              classes: classes.map((candidate) => candidate.name),
            });
          classes = matches;
        }
        const everything = checked.data.include === "all";
        const assignments: Listed[] = classes
          .flatMap((schoolClass) =>
            schoolClass.assignments
              .filter(
                (work) =>
                  everything ||
                  (GRADED.includes(work.kind) && work.status !== "returned"),
              )
              .map((work) => ({
                class: schoolClass.name,
                teacher: schoolClass.teacher,
                title: work.title,
                kind: work.kind,
                status: work.status,
                due: work.due,
                dueLocal: localText(work.due, hub.timeZone),
                overdue:
                  work.status === "missing" ||
                  (work.status === "open" &&
                    work.due !== null &&
                    Date.parse(work.due) < instant.getTime()),
                points: work.points,
                grade: work.grade,
                minutes: work.minutes,
                helpLevel: work.level,
                help: HELP_LEVEL_LABEL[work.level],
                helpSetBy: work.source,
              })),
          )
          .sort(byDue);
        return JSON.stringify({
          now: instant.toISOString(),
          timeZone: hub.timeZone,
          syncedAt: hub.syncedAt,
          classes: classes.map((schoolClass) => ({
            name: schoolClass.name,
            teacher: schoolClass.teacher,
            period: schoolClass.period,
            helpLevel: schoolClass.level,
            help: HELP_LEVEL_LABEL[schoolClass.level],
          })),
          assignments,
          ...(hub.couldNotRead.length > 0
            ? { couldNotRead: hub.couldNotRead }
            : {}),
        });
      },
    },
  ];
}

/** The arguments without a blank class, which a model sends for "every class". */
function blankless(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const body = { ...(args as Record<string, unknown>) };
  if (typeof body.class === "string" && body.class.trim() === "")
    delete body.class;
  if (body.include === "" || body.include === null) delete body.include;
  return body;
}
