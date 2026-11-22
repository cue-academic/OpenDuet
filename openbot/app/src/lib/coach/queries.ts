import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";
import type { CoachState } from "./model";

/*
 * The Coach tab's state as the student's account keeps it (/api/openduet/study/coach). The screen
 * reads the store (store.ts), not this: sync.ts is the one reader, and it puts what it finds there.
 */

export const coachKeys = {
  all: ["openduet-coach"] as const,
  state: ["openduet-coach", "state"] as const,
};

/** The saved state and its revision. Both are null until the first save. */
export type CoachRecord = {
  state: CoachState | null;
  revision: number | null;
};

const UNREADABLE = "Couldn't load your Coach progress.";

/** A body of the wrong shape is a failed read, so a broken answer never replaces the student's week. */
export function coachRecordOf(value: unknown): CoachRecord {
  const record = value as Partial<CoachRecord> | null | undefined;
  if (record && record.state === null && record.revision === null)
    return { state: null, revision: null };
  if (
    !record ||
    typeof record.revision !== "number" ||
    record.state?.version !== 1 ||
    !Array.isArray(record.state.assignments) ||
    !Array.isArray(record.state.sessions) ||
    !Array.isArray(record.state.checkIns) ||
    !Array.isArray(record.state.classes) ||
    !record.state.profile
  )
    throw new Error(UNREADABLE);
  return { state: record.state, revision: record.revision };
}

/** GET /api/openduet/study/coach */
export function coachQueryOptions() {
  return queryOptions({
    queryKey: coachKeys.state,
    queryFn: async ({ signal }): Promise<CoachRecord> =>
      coachRecordOf(
        await client<unknown>("/api/openduet/study/coach", "coach", {
          fallback: UNREADABLE,
          signal,
        }),
      ),
  });
}
