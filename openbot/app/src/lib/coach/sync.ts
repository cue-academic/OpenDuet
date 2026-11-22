import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { saveCoachMutationOptions } from "./mutations";
import { type CoachRecord, coachKeys, coachQueryOptions } from "./queries";
import { demoState } from "./seed";
import {
  adoptServerCoach,
  claimCoach,
  getCoachState,
  getCoachSync,
  markCoachSaved,
  subscribeCoach,
  syncAchievements,
} from "./store";

/*
 * Keeps this browser's copy of the Coach tab level with the account's copy on the server.
 *
 * - The account has a copy this browser isn't level with: the account's wins and is taken.
 * - The account has none: this browser's copy is saved as the first one. That is how a week kept
 *   only in a browser before the server stored it moves to the account.
 * - This browser's copy belongs to someone else who signed in here: it is never saved to this
 *   account or shown. The sample week replaces it before the screen paints, then the account's
 *   copy is taken when it has one.
 * - A school pack (source "private") stays on this machine and is never sent.
 *
 * A save names the revision it was made on. If another device saved first, the server keeps its copy
 * and sends it back, and that copy is taken here.
 */

const SAVE_AFTER_MS = 400;

/** Settles the two copies. True when this browser's copy should now be saved. */
export function reconcileCoach(owner: string, remote: CoachRecord): boolean {
  const local = getCoachState();
  if (local.source === "private") return false;
  const sync = getCoachSync();
  const foreign = sync !== null && sync.owner !== owner;
  if (remote.state && remote.revision !== null) {
    if (!sync || foreign || sync.revision !== remote.revision) {
      adoptServerCoach(owner, remote.state, remote.revision);
      return false;
    }
    return sync.dirty;
  }
  if (foreign) startOver(owner);
  else claimCoach(owner, null);
  return true;
}

/** The sample week, as this person's, with the badges it has already earned. */
function startOver(owner: string): void {
  claimCoach(owner, null, demoState(new Date()));
  syncAchievements();
}

/**
 * Someone else's week left in this browser is replaced with the sample week. Called before the
 * screen paints, so the person signing in never sees the other one's check-ins while theirs load.
 */
export function dropForeignCoach(owner: string): void {
  const sync = getCoachSync();
  if (!sync || sync.owner === owner) return;
  if (getCoachState().source === "private") return;
  startOver(owner);
}

/** Call once from the Coach screen with the signed-in person's id. */
export function useCoachSync(owner: string | undefined): void {
  const queryClient = useQueryClient();
  const remote = useQuery({
    ...coachQueryOptions(),
    enabled: Boolean(owner),
  }).data;
  const { mutateAsync } = useMutation(saveCoachMutationOptions());
  const saving = useRef(false);

  useLayoutEffect(() => {
    if (owner) dropForeignCoach(owner);
  }, [owner]);

  const save = useCallback(async () => {
    if (!owner || saving.current) return;
    const sync = getCoachSync();
    const state = getCoachState();
    if (!sync?.dirty || sync.owner !== owner || state.source === "private")
      return;
    saving.current = true;
    let again = false;
    try {
      const { coach, saved } = await mutateAsync({
        state,
        revision: sync.revision,
      });
      if (saved && coach.revision !== null) {
        markCoachSaved(owner, coach.revision, state);
        again = getCoachSync()?.dirty === true;
      } else if (coach.state && coach.revision !== null) {
        adoptServerCoach(owner, coach.state, coach.revision);
      }
      queryClient.setQueryData(coachKeys.state, coach);
    } catch {
      // Still marked unsaved, so the next change or the next visit sends it.
    } finally {
      saving.current = false;
    }
    if (again) void save();
  }, [owner, mutateAsync, queryClient]);

  useEffect(() => {
    if (!owner || !remote) return;
    if (reconcileCoach(owner, remote)) void save();
  }, [owner, remote, save]);

  useEffect(() => {
    if (!owner || !remote) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeCoach(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void save(), SAVE_AFTER_MS);
    });
    return () => {
      unsubscribe();
      if (timer === undefined) return;
      clearTimeout(timer);
      void save();
    };
  }, [owner, remote, save]);
}
