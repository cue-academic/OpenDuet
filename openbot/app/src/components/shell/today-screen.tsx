import {
  IconArrowRight,
  IconCalendarWeek,
  IconClockHour4,
  IconFlag,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  clockLabel,
  dayLabel,
  deviceNow,
  stepDay,
  zonedNow,
} from "@/components/calendar/rebound/calendar-data";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { coachFormat, validCoachTimeZone } from "@/lib/coach/clock";
import { localDate } from "@/lib/coach/model";
import { calendarQueryOptions } from "@/lib/study/calendar";
import { hubQueryOptions } from "@/lib/study/rules";
import { dailyAgenda, daysUntil, nextDeadline } from "@/lib/study/today";

const ACTION =
  "inline-flex min-h-11 w-fit items-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-duet-accent";

export function TodayScreen() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const device = deviceNow(now);
  const hub = useQuery(hubQueryOptions());
  const { data: user } = useQuery(currentUserQueryOptions());
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const hubZone = validCoachTimeZone(hub.data?.timeZone);
  // A day on either side of UTC includes today in every calendar time zone.
  const anchor = now.toISOString().slice(0, 10);
  const calendar = useQuery(
    calendarQueryOptions(stepDay(anchor, "day", -1), stepDay(anchor, "day", 1)),
  );
  const view = calendar.data;
  const clock = view
    ? (zonedNow(now, view.timeZone) ?? {
        day: view.today,
        minute: view.nowMinute,
      })
    : (hubZone && zonedNow(now, hubZone)) || device;
  const agenda =
    view && view.from <= clock.day && clock.day <= view.to
      ? dailyAgenda(view, clock.day, clock.minute)
      : undefined;
  const next = agenda?.next;
  const deadline = hub.data ? nextDeadline(hub.data, now) : undefined;
  const days = deadline
    ? daysUntil(localDate(now, hubZone), localDate(deadline.due, hubZone))
    : null;
  const countdown =
    days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `In ${days} days`;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[76rem] px-4 pt-7 pb-12 sm:px-8 sm:pt-10 lg:px-12">
        <header className="mb-6 sm:mb-8">
          <p className="mb-2 font-semibold text-duet-accent text-sm">
            {dayLabel(clock.day, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="cue-editorial text-[clamp(2.375rem,5vw,4rem)] leading-none text-duet-ink">
            {firstName ? `Your day, ${firstName}` : "Your day"}
          </h1>
        </header>

        <section
          aria-labelledby="today-next"
          className="relative isolate grid min-w-0 overflow-hidden rounded-[1.75rem] border border-duet-hair bg-duet-accent-soft px-5 py-6 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-8 sm:py-8 lg:px-10"
        >
          <div className="relative z-10 min-w-0">
            <p className="mb-3 flex items-center gap-2 font-semibold text-duet-accent text-sm">
              <IconClockHour4 aria-hidden size={17} />
              Up next
            </p>
            <h2
              className="cue-editorial wrap-break-word text-[clamp(1.875rem,4.1vw,3.25rem)] leading-[1.04] text-duet-ink"
              id="today-next"
            >
              {next?.title ?? "Make a plan for today"}
            </h2>
            <p className="mt-3 max-w-[36ch] text-duet-ink-2 text-sm sm:text-base">
              {next?.start
                ? `${clockLabel(next.start)}${next.end ? ` to ${clockLabel(next.end)}` : ""} · ${next.kind}`
                : "See what needs your attention and set aside time for it."}
            </p>
            {next ? (
              <Link
                className={`${ACTION} mt-5 bg-duet-accent px-4 text-duet-on-accent text-sm hover:opacity-90`}
                search={{ date: clock.day }}
                to="/calendar"
              >
                Open calendar <IconArrowRight aria-hidden size={17} />
              </Link>
            ) : (
              <Link
                className={`${ACTION} mt-5 bg-duet-accent px-4 text-duet-on-accent text-sm hover:opacity-90`}
                to="/coach"
              >
                Open Coach <IconArrowRight aria-hidden size={17} />
              </Link>
            )}
          </div>
          <Notebook />
        </section>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="today-agenda"
            className="min-w-0 rounded-3xl border border-duet-hair bg-duet-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <h2
                className="cue-editorial flex min-w-0 items-center gap-2 text-2xl text-duet-ink"
                id="today-agenda"
              >
                <IconCalendarWeek
                  aria-hidden
                  className="shrink-0 text-duet-accent"
                  size={20}
                />
                What you have today
              </h2>
              <Link
                className={`${ACTION} text-duet-accent text-sm hover:underline`}
                search={{ date: clock.day }}
                to="/calendar"
              >
                Calendar <IconArrowRight aria-hidden size={15} />
              </Link>
            </div>
            {agenda?.items.length ? (
              <ul className="mt-2 divide-y divide-duet-hair">
                {agenda.items.slice(0, 4).map((item) => (
                  <li
                    className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-3 py-2.5"
                    key={item.id}
                  >
                    <span className="text-duet-ink-3 text-sm tabular-nums">
                      {item.start ? clockLabel(item.start) : "All day"}
                    </span>
                    <span className="wrap-break-word font-semibold text-duet-ink text-sm">
                      {item.title}
                      {item.done ? (
                        <span className="ml-2 font-normal text-duet-status-done">
                          Done
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-duet-ink-2 text-sm" role="status">
                {calendar.isPending
                  ? "Loading your calendar…"
                  : calendar.isError
                    ? "Couldn't load your calendar."
                    : view?.couldNotRead.length
                      ? "Some of your calendar isn't available."
                      : "Nothing on your calendar today."}
              </p>
            )}
            {agenda?.items.length && view?.couldNotRead.length ? (
              <p className="mt-2 text-duet-ink-3 text-sm">
                Some events may be missing.
              </p>
            ) : null}
          </section>

          <section
            aria-labelledby="today-deadline"
            className="min-w-0 rounded-3xl border border-duet-hair bg-duet-status-needs-soft p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <h2
                className="cue-editorial flex items-center gap-2 text-2xl text-duet-ink"
                id="today-deadline"
              >
                <IconFlag
                  aria-hidden
                  className="shrink-0 text-duet-status-needs"
                  size={20}
                />
                Next deadline
              </h2>
              <Link
                className={`${ACTION} text-duet-status-needs text-sm hover:underline`}
                to="/classes"
              >
                Classes <IconArrowRight aria-hidden size={15} />
              </Link>
            </div>
            {deadline ? (
              <div className="mt-2">
                <p className="cue-editorial text-3xl text-duet-ink">
                  {countdown}
                </p>
                <p className="mt-2 wrap-break-word font-semibold text-duet-ink">
                  {deadline.assignment.title}
                </p>
                <p className="mt-1 wrap-break-word text-duet-ink-2 text-sm">
                  {deadline.course.name} ·{" "}
                  {coachFormat(
                    deadline.due,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                    hubZone,
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-duet-ink-2 text-sm" role="status">
                {hub.isPending
                  ? "Loading your deadlines…"
                  : hub.isError || hub.data?.couldNotRead.length
                    ? "Couldn't load your deadlines."
                    : "No upcoming deadlines in Classes."}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Notebook() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none mx-auto hidden h-48 w-full max-w-[22rem] text-duet-accent sm:block lg:h-56"
      fill="none"
      viewBox="0 0 340 220"
    >
      <path
        d="M54 165c52 36 185 43 240-3M88 192c36 14 87 15 119 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity=".35"
      />
      <rect
        x="105"
        y="43"
        width="157"
        height="135"
        rx="13"
        fill="var(--duet-status-needs-soft)"
        stroke="currentColor"
        strokeWidth="1.7"
        transform="rotate(12 184 110)"
      />
      <g transform="rotate(-10 157 112)">
        <rect
          x="77"
          y="36"
          width="164"
          height="146"
          rx="12"
          fill="var(--duet-card)"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M105 36v146M132 86h78m-78 22h68m-68 22h78m-78 22h57"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
          opacity=".36"
        />
        <path
          d="M85 57H70m15 22H70m15 22H70m15 22H70m15 22H70m15 22H70"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path d="M185 36h24v45l-12-8-12 8V36Z" fill="var(--duet-accent)" />
        <path
          d="m133 58 4 4 8-9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        />
      </g>
      <path
        d="M278 52c14 0 20-7 20-20 0 13 6 20 20 20-14 0-20 7-20 20 0-13-6-20-20-20ZM38 108v18m-9-9h18m238 12v16m-8-8h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
