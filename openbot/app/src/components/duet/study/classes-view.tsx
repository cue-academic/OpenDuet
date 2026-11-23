import type {
  AssignmentKind,
  HelpLevel,
  HubAssignment,
  HubClass,
  SchoolHub,
} from "@openbot/shared/study";
import type { ReactNode } from "react";
import { agoShort } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { DuetIcon } from "../icons";
import { classColorVar, dayLabel, formatMinutes } from "./format";
import { HelpLevelPill } from "./help-level-pill";

/*
 * The Classes page's body: every class the student takes, with its work, when each piece is due and
 * the AI-help level in force for it. Props only, so it can be drawn and tested alone; the route reads
 * the hub (GET /api/openduet/study/hub) and owns the requests.
 *
 * It only shows. A level is changed on Teacher rules, which each class links to.
 */

const PILL =
  "type-caption inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 font-medium transition-[filter,transform,background-color] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 active:scale-[0.98] aria-disabled:opacity-50";
const QUIET =
  "text-duet-ink shadow-[inset_0_0_0_1px_var(--duet-hair)] hover:bg-duet-tile";
const LINK =
  "type-caption -mb-2 inline-flex min-h-11 items-center rounded-full font-medium text-duet-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40";

type LinkSlot = (props: {
  className: string;
  children: ReactNode;
}) => ReactNode;

export type ClassesViewProps = {
  /** The hub, or null while it loads or after it failed to. */
  hub: SchoolHub | null;
  loadError: string | null;
  onReload: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshError: string | null;
  /** A link to Connections, drawn by the route so this needs no router. */
  connections: LinkSlot;
  /** A link to Teacher rules, drawn by the route. */
  rules: LinkSlot;
  now?: Date;
};

const KIND_LABEL: Record<AssignmentKind, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  test: "Test",
  announcement: "Announcement",
  material: "Material",
};

const NBSP = "\u00a0";

/** The day ("YYYY-MM-DD") and minute of the day an instant falls on in a time zone. */
function zoned(
  instant: Date,
  timeZone: string,
): { date: string; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value ?? "";
    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      minutes: Number(part("hour")) * 60 + Number(part("minute")),
    };
  } catch {
    // A zone the browser doesn't know: the due line says less, never the wrong day.
    return null;
  }
}

function clockText(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = String(minutes % 60).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${rest}${NBSP}${hours < 12 ? "AM" : "PM"}`;
}

/** "Due tomorrow, 10:45 AM", "Missing · was due Tue, Nov 3, 11:59 PM", "No due date". */
export function hubDueText(
  work: Pick<HubAssignment, "status" | "due" | "grade">,
  now: Date,
  timeZone: string,
): string {
  if (work.status === "returned")
    return work.grade ? `Returned · ${work.grade}` : "Returned";
  const due = work.due === null ? Number.NaN : Date.parse(work.due);
  if (Number.isNaN(due))
    return work.status === "missing" ? "Missing" : "No due date";
  const at = zoned(new Date(due), timeZone);
  if (!at) return work.status === "missing" ? "Missing" : "Has a due date";
  const day = dayLabel(at.date, zoned(now, timeZone)?.date);
  const when = `${day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day}, ${clockText(at.minutes)}`;
  if (work.status === "missing") return `Missing · was due ${when}`;
  return due < now.getTime() ? `Was due ${when}` : `Due ${when}`;
}

/** Work the student still has to hand in or sit. */
const isToDo = (work: HubAssignment) =>
  work.status !== "returned" &&
  (work.kind === "assignment" || work.kind === "quiz" || work.kind === "test");

export function ClassesView({
  hub,
  loadError,
  onReload,
  onRefresh,
  refreshing,
  refreshError,
  connections,
  rules,
  now = new Date(),
}: ClassesViewProps) {
  if (!hub) {
    if (!loadError)
      return (
        <p className="type-caption mt-8 text-duet-ink-2" role="status">
          Loading your classes…
        </p>
      );
    return (
      <div className="mt-8">
        <p className="type-caption text-duet-status-problem" role="alert">
          {loadError}
        </p>
        <button
          className={cn(PILL, QUIET, "mt-3")}
          onClick={onReload}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const toDo = hub.classes.reduce(
    (count, schoolClass) =>
      count + schoolClass.assignments.filter(isToDo).length,
    0,
  );

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          aria-disabled={refreshing || undefined}
          className={cn(PILL, QUIET)}
          onClick={() => {
            if (!refreshing) onRefresh();
          }}
          type="button"
        >
          <DuetIcon name="repeat" size={18} />
          {refreshing ? "Refreshing…" : "Refresh from Classroom"}
        </button>
        <p aria-live="polite" className="type-caption text-duet-ink-2">
          {hub.syncedAt
            ? `Last read ${agoShort(hub.syncedAt, now.getTime())}`
            : "Not read yet"}
          {hub.classes.length > 0
            ? ` · ${hub.classes.length} ${hub.classes.length === 1 ? "class" : "classes"}, ${toDo} to do`
            : ""}
        </p>
      </div>
      {refreshError ? (
        <p className="type-caption mt-2 text-duet-status-problem" role="alert">
          {refreshError}
        </p>
      ) : null}
      {hub.couldNotRead.length > 0 ? (
        <div
          aria-label="Not everything could be read"
          className="mt-5 flex gap-3 rounded-[var(--duet-radius-card)] bg-duet-tile px-4 py-3"
          role="note"
        >
          <DuetIcon
            className="mt-px shrink-0 text-duet-ink-2"
            name="alert"
            size={18}
          />
          <div className="min-w-0 flex-1">
            <p className="type-caption font-medium text-duet-ink">
              Not everything could be read
            </p>
            <ul className="mt-0.5">
              {[...new Set(hub.couldNotRead)].map((line) => (
                <li
                  className="type-caption text-duet-ink-2 [overflow-wrap:anywhere]"
                  key={line}
                >
                  {line}
                </li>
              ))}
            </ul>
            {connections({ className: LINK, children: "Open Connections" })}
          </div>
        </div>
      ) : null}
      {hub.classes.length === 0 ? (
        <div className="mt-8 max-w-prose">
          <p className="study-display type-nav text-duet-ink">
            {hub.syncedAt
              ? "No classes found yet"
              : "Your classes haven't been read yet"}
          </p>
          <p className="type-caption mt-1 text-pretty text-duet-ink-2">
            {hub.syncedAt
              ? "Your Gmail has no Google Classroom emails from the last 30 days. If your school uses a different Google account, connect that one."
              : "Connect the Google account your school uses, then refresh from Classroom. Your classes and assignments show up here."}
          </p>
          {hub.couldNotRead.length > 0
            ? null
            : connections({ className: LINK, children: "Open Connections" })}
        </div>
      ) : (
        hub.classes.map((schoolClass) => (
          <ClassSection
            key={schoolClass.id}
            now={now}
            rules={rules}
            schoolClass={schoolClass}
            timeZone={hub.timeZone}
          />
        ))
      )}
    </>
  );
}

function ClassSection({
  schoolClass,
  now,
  timeZone,
  rules,
}: {
  schoolClass: HubClass;
  now: Date;
  timeZone: string;
  rules: LinkSlot;
}) {
  const who = [
    schoolClass.teacher,
    schoolClass.period
      ? /^\d+$/.test(schoolClass.period)
        ? `Period ${schoolClass.period}`
        : schoolClass.period
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      className="mt-5 rounded-3xl border border-duet-hair bg-duet-surface p-4 sm:p-5"
      aria-label={schoolClass.name}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="border-l-[3px] pl-3"
          style={{ borderColor: classColorVar(schoolClass.color) }}
        >
          <h2 className="cue-editorial text-2xl text-duet-ink">
            {schoolClass.name}
          </h2>
          {who ? (
            <p className="type-caption mt-1 text-duet-ink-2">{who}</p>
          ) : null}
        </div>
        <HelpLevelPill level={schoolClass.level} />
      </div>
      <div className="mt-3">
        {schoolClass.assignments.length === 0 ? (
          <p className="type-caption px-4 py-4 text-duet-ink-2">
            Nothing posted for this class yet.
          </p>
        ) : (
          <ul
            className="divide-y divide-duet-hair"
            aria-label={`${schoolClass.name} assignments`}
          >
            {schoolClass.assignments.map((work) => (
              <li key={work.id}>
                <AssignmentRow
                  classRule={schoolClass.level}
                  now={now}
                  timeZone={timeZone}
                  work={work}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {rules({ className: LINK, children: "Change this class's rule" })}
    </section>
  );
}

function AssignmentRow({
  work,
  classRule,
  now,
  timeZone,
}: {
  work: HubAssignment;
  classRule: HelpLevel;
  now: Date;
  timeZone: string;
}) {
  const facts = [
    hubDueText(work, now, timeZone),
    KIND_LABEL[work.kind],
    work.points === null ? null : `${work.points} points`,
    isToDo(work) && work.minutes > 0
      ? `About ${formatMinutes(work.minutes)}`
      : null,
  ].filter(Boolean);
  return (
    <div
      className="flex flex-wrap items-start gap-3 py-4"
      data-status={work.status}
    >
      <div className="min-w-0 flex-1">
        <h3 className="type-sub font-medium text-duet-ink [overflow-wrap:anywhere]">
          {work.link ? (
            <a
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40"
              href={work.link}
              rel="noreferrer"
              target="_blank"
            >
              {work.title}
            </a>
          ) : (
            work.title
          )}
        </h3>
        <p className="type-caption mt-0.5 text-duet-ink-2">
          {facts.join(" · ")}
        </p>
      </div>
      {work.level !== classRule ? <HelpLevelPill level={work.level} /> : null}
    </div>
  );
}
