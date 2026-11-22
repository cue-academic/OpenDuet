import { useSyncExternalStore } from "react";
import { newId } from "@/lib/new-id";
import type { Assignment, CheckIn, CoachState, Profile } from "./model";
import { localDate } from "./model";
import { newlyEarned } from "./progress";
import { blankState, demoState } from "./seed";

/*
 * The Coach tab's state. One store for the tab, read with useSyncExternalStore so every card
 * redraws together after a change. The copy the student's account keeps is on the server (sync.ts
 * saves each change there and takes what another device saved); localStorage holds this browser's
 * copy under one key, so the tab draws at once and a change made offline is saved later. Storage
 * can be missing or full; the tab then still works for the visit.
 */

export const COACH_STORAGE_KEY = "academic-os.coach.v1";
export const COACH_SYNC_KEY = "academic-os.coach.sync.v1";
export const COACH_BASE_KEY = "academic-os.coach.base.v1";
export const TIMER_STORAGE_KEY = "academic-os.coach.timer.v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: CoachState | null = null;

function read(): CoachState {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(COACH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CoachState;
      if (parsed?.version === 1) {
        cached = parsed;
        return parsed;
      }
    }
  } catch {
    // Unreadable or unavailable: start from the demo week.
  }
  cached = demoState(new Date());
  return cached;
}

/**
 * How this browser's copy stands against the account's: whose it is, the server revision it was
 * last level with (null before a first save), and whether it has changed since. Absent for a copy
 * made before the server kept one.
 */
export type CoachSync = {
  owner: string;
  revision: number | null;
  dirty: boolean;
};

let syncCached: CoachSync | null | undefined;

export function getCoachSync(): CoachSync | null {
  if (syncCached !== undefined) return syncCached;
  try {
    const raw = window.localStorage.getItem(COACH_SYNC_KEY);
    syncCached = raw ? (JSON.parse(raw) as CoachSync) : null;
  } catch {
    syncCached = null;
  }
  return syncCached;
}

function setCoachSync(next: CoachSync): void {
  syncCached = next;
  try {
    window.localStorage.setItem(COACH_SYNC_KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this visit.
  }
}

let baseCached: CoachState | null | undefined;

/**
 * The copy this browser was last level with the account on. When another device saves first, it is
 * what tells this browser's own changes apart from the other device's (merge.ts).
 */
export function getCoachBase(): CoachState | null {
  if (baseCached !== undefined) return baseCached;
  try {
    const raw = window.localStorage.getItem(COACH_BASE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CoachState) : null;
    baseCached = parsed?.version === 1 ? parsed : null;
  } catch {
    baseCached = null;
  }
  return baseCached;
}

function setCoachBase(next: CoachState | null): void {
  baseCached = next;
  try {
    if (next) window.localStorage.setItem(COACH_BASE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(COACH_BASE_KEY);
  } catch {
    // Kept in memory for this visit.
  }
}

function store(next: CoachState): void {
  cached = next;
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this visit.
  }
}

function write(next: CoachState): void {
  store(next);
  const sync = getCoachSync();
  if (sync && !sync.dirty) setCoachSync({ ...sync, dirty: true });
  for (const listener of listeners) listener();
}

/** Take the account's copy as this browser's: nothing is left to save. */
export function adoptServerCoach(
  owner: string,
  state: CoachState,
  revision: number,
): void {
  store(state);
  setCoachBase(state);
  setCoachSync({ owner, revision, dirty: false });
  for (const listener of listeners) listener();
}

/**
 * Another device saved first: `merged` holds both devices' changes, `theirs` is what the account
 * has at `revision`. The merged copy is shown and is still to be saved on top of that revision.
 */
export function rebaseCoach(
  owner: string,
  revision: number,
  theirs: CoachState,
  merged: CoachState,
): void {
  store(merged);
  setCoachBase(theirs);
  setCoachSync({ owner, revision, dirty: true });
  for (const listener of listeners) listener();
}

/** This browser's copy becomes the person's, still to be saved on top of `revision`. */
export function claimCoach(
  owner: string,
  revision: number | null,
  state?: CoachState,
): void {
  if (state) store(state);
  if (revision === null) setCoachBase(null);
  setCoachSync({ owner, revision, dirty: true });
  if (state) for (const listener of listeners) listener();
}

/** A save landed. Anything changed while it was on its way is still to be saved. */
export function markCoachSaved(
  owner: string,
  revision: number,
  saved: CoachState,
): void {
  setCoachBase(saved);
  setCoachSync({ owner, revision, dirty: read() !== saved });
}

export function subscribeCoach(listener: Listener): () => void {
  return subscribe(listener);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCoachState(): CoachState {
  return read();
}

/** For tests: forget what was read so the next read goes back to storage. */
export function resetCoachCache(): void {
  cached = null;
  syncCached = undefined;
  baseCached = undefined;
  timerCached = undefined;
}

export function useCoachState(): CoachState {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Apply a change, then stamp any achievement it earned. Returns the achievements newly earned, so
 * the screen can celebrate them.
 */
export function updateCoach(
  change: (state: CoachState) => CoachState,
  now = new Date(),
) {
  const changed = change(read());
  const earned = newlyEarned(changed, now);
  if (!earned.length) {
    write(changed);
    return [];
  }
  const unlocked = { ...changed.unlocked };
  for (const a of earned) unlocked[a.id] = now.toISOString();
  write({ ...changed, unlocked });
  return earned;
}

/**
 * Stamp what the state has already earned without celebrating it, for the first open of a seeded
 * week or one saved before a badge existed.
 */
export function syncAchievements(now = new Date()): void {
  const state = read();
  if (newlyEarned(state, now).length) updateCoach((s) => s, now);
}

/* ---------------------------------------------------------------- Actions ---------------------- */

export function logSession(
  assignmentId: string | null,
  minutes: number,
  startedAt: Date,
  now = new Date(),
) {
  return updateCoach(
    (s) => ({
      ...s,
      sessions: [
        ...s.sessions,
        {
          id: newId(),
          assignmentId,
          startedAt: startedAt.toISOString(),
          minutes,
        },
      ],
      assignments: s.assignments.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              spentMin: a.spentMin + minutes,
              status: a.status === "todo" ? "doing" : a.status,
            }
          : a,
      ),
    }),
    now,
  );
}

export function setDone(id: string, done: boolean, now = new Date()) {
  return updateCoach(
    (s) => ({
      ...s,
      assignments: s.assignments.map((a) =>
        a.id === id
          ? {
              ...a,
              status: done ? "done" : a.spentMin > 0 ? "doing" : "todo",
              doneAt: done ? now.toISOString() : null,
            }
          : a,
      ),
    }),
    now,
  );
}

export function saveAssignment(
  input: Omit<Assignment, "id" | "spentMin" | "status" | "doneAt"> & {
    id?: string;
  },
  now = new Date(),
) {
  return updateCoach((s) => {
    const existing = input.id
      ? s.assignments.find((a) => a.id === input.id)
      : undefined;
    if (existing)
      return {
        ...s,
        assignments: s.assignments.map((a) =>
          a.id === existing.id ? { ...a, ...input, id: a.id } : a,
        ),
      };
    const created: Assignment = {
      ...input,
      id: newId(),
      spentMin: 0,
      status: "todo",
      doneAt: null,
    };
    return { ...s, assignments: [...s.assignments, created] };
  }, now);
}

export function removeAssignment(id: string) {
  return updateCoach((s) => ({
    ...s,
    assignments: s.assignments.filter((a) => a.id !== id),
  }));
}

export function saveCheckIn(checkIn: Omit<CheckIn, "date">, now = new Date()) {
  const date = localDate(now);
  return updateCoach(
    (s) => ({
      ...s,
      checkIns: [
        ...s.checkIns.filter((c) => c.date !== date),
        { ...checkIn, date },
      ],
    }),
    now,
  );
}

export function saveProfile(
  profile: Partial<Profile>,
  classes?: CoachState["classes"],
) {
  return updateCoach((s) => ({
    ...s,
    profile: { ...s.profile, ...profile },
    classes: classes ?? s.classes,
  }));
}

export function restartWithDemo(now = new Date()) {
  write(demoState(now));
}

const SAMPLE_ASSIGNMENT_IDS = [
  "apush-dbq",
  "chem-lab5",
  "chem-lab6",
  "eng-gatsby",
  "precalc-hw43",
  "precalc-quiz4",
  "spanish-u5",
].join(",");

/** The generic week, still the one first written, so a school pack may replace it. */
export function isUntouchedSample(state: CoachState): boolean {
  if (!state.demo || state.profile.setupDone || state.source === "private")
    return false;
  const ids = state.assignments
    .map((assignment) => assignment.id)
    .sort()
    .join(",");
  if (ids !== SAMPLE_ASSIGNMENT_IDS) return false;
  const lab5 = state.assignments.find(
    (assignment) => assignment.id === "chem-lab5",
  );
  const lab6 = state.assignments.find(
    (assignment) => assignment.id === "chem-lab6",
  );
  return lab5?.status === "done" && lab6?.status === "doing";
}

/** Replace the generic week with a school pack. A week the student edited is kept. */
export function adoptPrivatePack(next: CoachState): boolean {
  if (!isUntouchedSample(read())) return false;
  write(next);
  return true;
}

export function startFresh(name: string) {
  write(blankState(name));
}

/* ---------------------------------------------------------------- Focus timer ------------------ */

export type TimerState = {
  assignmentId: string | null;
  phase: "focus" | "break";
  lengthMin: number;
  /** When the running phase began, ISO. */
  startedAt: string;
  /** When the running phase ends, ISO. Null while paused. */
  endsAt: string | null;
  /** Milliseconds left, kept while paused. */
  pausedLeftMs: number | null;
};

const timerListeners = new Set<Listener>();
let timerCached: TimerState | null | undefined;

function readTimer(): TimerState | null {
  if (timerCached !== undefined) return timerCached;
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    timerCached = raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    timerCached = null;
  }
  return timerCached;
}

export function setTimer(next: TimerState | null): void {
  timerCached = next;
  try {
    if (next)
      window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch {
    // In memory only.
  }
  for (const listener of timerListeners) listener();
}

export function useTimer(): TimerState | null {
  return useSyncExternalStore(
    (l) => {
      timerListeners.add(l);
      return () => timerListeners.delete(l);
    },
    readTimer,
    readTimer,
  );
}

export function getTimer(): TimerState | null {
  return readTimer();
}
