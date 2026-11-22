import type { CoachState } from "./model";

/*
 * Two devices changed the Coach tab from the same starting point. `base` is that starting point
 * (the last copy this browser was level with the account on), `mine` is this browser's copy and
 * `theirs` is what the other device saved. Each change is kept: what this browser changed since
 * base stays, and everything else is taken from the other device. Only when both changed the same
 * field of the same thing does one give way, and this browser's edit, the newer one, is kept.
 */

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Field by field: mine where I changed it, theirs otherwise. */
function mergeFields<T extends object>(base: T, mine: T, theirs: T): T {
  const merged = { ...theirs };
  for (const key of Object.keys(mine) as (keyof T)[]) {
    if (!same(mine[key], base[key])) merged[key] = mine[key];
  }
  return merged;
}

/** A list of things with a key: adds, edits and removals from both sides. */
function mergeList<T extends object>(
  base: T[],
  mine: T[],
  theirs: T[],
  keyOf: (item: T) => string,
  mergeItem: (base: T, mine: T, theirs: T) => T = mergeFields,
): T[] {
  const baseBy = new Map(base.map((item) => [keyOf(item), item]));
  const mineBy = new Map(mine.map((item) => [keyOf(item), item]));
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const their of theirs) {
    const key = keyOf(their);
    seen.add(key);
    const was = baseBy.get(key);
    const my = mineBy.get(key);
    // Removed here, and they hadn't touched it.
    if (!my && was && same(was, their)) continue;
    if (!my || !was)
      merged.push(my && !was ? mergeItem(their, my, their) : their);
    else merged.push(mergeItem(was, my, their));
  }
  for (const my of mine) {
    const key = keyOf(my);
    if (seen.has(key)) continue;
    const was = baseBy.get(key);
    // Added here, or changed here after they removed it. Unchanged and removed there stays removed.
    if (!was || !same(was, my)) merged.push(my);
  }
  return merged;
}

export function mergeCoach(
  base: CoachState,
  mine: CoachState,
  theirs: CoachState,
): CoachState {
  const unlocked = { ...theirs.unlocked };
  for (const [id, at] of Object.entries(mine.unlocked)) {
    // A badge earned on both keeps the earlier time.
    if (!unlocked[id] || at < unlocked[id]) unlocked[id] = at;
  }
  const merged: CoachState = {
    ...mergeFields(
      { demo: base.demo, source: base.source },
      { demo: mine.demo, source: mine.source },
      { demo: theirs.demo, source: theirs.source },
    ),
    version: 1,
    profile: mergeFields(base.profile, mine.profile, theirs.profile),
    classes: mergeList(base.classes, mine.classes, theirs.classes, (c) => c.id),
    assignments: mergeList(
      base.assignments,
      mine.assignments,
      theirs.assignments,
      (a) => a.id,
      (was, my, their) => ({
        ...mergeFields(was, my, their),
        // Focus logged on both devices adds up.
        spentMin: Math.max(0, their.spentMin + my.spentMin - was.spentMin),
      }),
    ),
    sessions: mergeList(
      base.sessions,
      mine.sessions,
      theirs.sessions,
      (s) => s.id,
    ),
    checkIns: mergeList(
      base.checkIns,
      mine.checkIns,
      theirs.checkIns,
      (c) => c.date,
    ),
    unlocked,
  };
  if (merged.source === undefined) delete merged.source;
  return merged;
}
