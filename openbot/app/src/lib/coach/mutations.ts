import { mutationOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";
import type { CoachState } from "./model";
import { type CoachRecord, coachRecordOf } from "./queries";

const FALLBACK = "Couldn't save your Coach changes.";

export type CoachSaveInput = {
  state: CoachState;
  /** The revision this state was made on. Null for a first save. */
  revision: number | null;
};

/** `saved` is false when another device saved first; `coach` is then that device's copy. */
export type CoachSaveResult = { coach: CoachRecord; saved: boolean };

/**
 * PUT /api/openduet/study/coach. No cache is invalidated here: sync.ts keeps the answer itself,
 * after it has noted the new revision, so a refetch can't land on top of a change still unsaved.
 */
export function saveCoachMutationOptions() {
  return mutationOptions({
    retry: false,
    mutationFn: async (input: CoachSaveInput): Promise<CoachSaveResult> => {
      // Two keys, so the envelope is read here.
      const response = await client("/api/openduet/study/coach", {
        method: "PUT",
        body: input,
        fallback: FALLBACK,
      });
      const body = (await response.json().catch(() => null)) as {
        coach?: unknown;
        saved?: unknown;
      } | null;
      if (!body || typeof body.saved !== "boolean") throw new Error(FALLBACK);
      return { coach: coachRecordOf(body.coach), saved: body.saved };
    },
  });
}
