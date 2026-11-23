export function validCoachTimeZone(value?: string): string | undefined {
  try {
    if (!value) return undefined;
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return undefined;
  }
}

export function coachParts(at: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function coachFormat(
  at: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string,
): string {
  return at.toLocaleDateString("en-US", { ...options, timeZone });
}

export function coachInstant(
  fields: ReturnType<typeof coachParts>,
  timeZone?: string,
): Date {
  if (!timeZone)
    return new Date(
      fields.year,
      fields.month - 1,
      fields.day,
      fields.hour,
      fields.minute,
      fields.second,
    );
  const stamp = (p: typeof fields) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const target = stamp(fields);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const difference = target - stamp(coachParts(new Date(instant), timeZone));
    if (!difference) break;
    instant += difference;
  }
  return new Date(instant);
}
