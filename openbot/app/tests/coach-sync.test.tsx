import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/" });
}

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { CoachState } from "../src/lib/coach/model";
import { demoState } from "../src/lib/coach/seed";
import {
  COACH_STORAGE_KEY,
  getCoachState,
  getCoachSync,
  resetCoachCache,
  restartWithDemo,
  saveCheckIn,
} from "../src/lib/coach/store";
import { reconcileCoach, useCoachSync } from "../src/lib/coach/sync";

afterAll(() => {
  GlobalRegistrator.unregister();
});

/** A stand-in for the server: one saved copy per test, with the route's revision rule. */
let server: { state: CoachState | null; revision: number | null };
let puts: { state: CoachState; revision: number | null }[];
let failSaves: boolean;
const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  resetCoachCache();
  server = { state: null, revision: null };
  puts = [];
  failSaves = false;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).endsWith("/api/openduet/study/coach"))
      return Response.json({});
    if (init?.method !== "PUT") return Response.json({ coach: server });
    const body = JSON.parse(String(init.body)) as (typeof puts)[number];
    puts.push(body);
    if (failSaves) return Response.json({ error: "down" }, { status: 500 });
    if (body.revision !== server.revision)
      return Response.json({ coach: server, saved: false });
    server = { state: body.state, revision: (server.revision ?? 0) + 1 };
    return Response.json({ coach: server, saved: true });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function Sync({ owner }: { owner: string }) {
  useCoachSync(owner);
  return null;
}

function mount(owner = "jordan") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Sync owner={owner} />
    </QueryClientProvider>,
  );
}

const NOW = new Date(2026, 10, 4, 16, 0);
const checkIn = { mood: 4, energy: 3, sleepHours: 8 };

describe("coach sync", () => {
  test("a week kept only in this browser is saved to the account on first visit", async () => {
    restartWithDemo(NOW);
    mount();
    await waitFor(() => expect(server.revision).toBe(1));
    expect(server.state).toEqual(getCoachState());
    expect(getCoachSync()).toEqual({
      owner: "jordan",
      revision: 1,
      dirty: false,
    });
  });

  test("a new browser takes the account's copy", async () => {
    const saved = demoState(NOW);
    saved.checkIns = [{ date: "2026-11-04", ...checkIn }];
    saved.profile = { ...saved.profile, name: "Jordan" };
    server = { state: saved, revision: 6 };
    mount();
    await waitFor(() => expect(getCoachState().profile.name).toBe("Jordan"));
    expect(getCoachState().checkIns).toEqual(saved.checkIns);
    expect(getCoachSync()?.revision).toBe(6);
    expect(puts).toHaveLength(0);
  });

  test("a check-in is saved to the account", async () => {
    restartWithDemo(NOW);
    mount();
    await waitFor(() => expect(server.revision).toBe(1));
    act(() => {
      saveCheckIn(checkIn, NOW);
    });
    expect(getCoachSync()?.dirty).toBe(true);
    await waitFor(() => expect(server.revision).toBe(2));
    expect(server.state?.checkIns.at(-1)).toEqual({
      date: "2026-11-04",
      ...checkIn,
    });
    await waitFor(() => expect(getCoachSync()?.dirty).toBe(false));
  });

  test("when another device saved first, its copy is taken", async () => {
    restartWithDemo(NOW);
    mount();
    await waitFor(() => expect(server.revision).toBe(1));
    const other = { ...demoState(NOW), demo: false };
    other.profile = { ...other.profile, name: "From the laptop" };
    server = { state: other, revision: 2 };
    act(() => {
      saveCheckIn(checkIn, NOW);
    });
    await waitFor(() =>
      expect(getCoachState().profile.name).toBe("From the laptop"),
    );
    expect(server.revision).toBe(2);
    expect(getCoachSync()).toEqual({
      owner: "jordan",
      revision: 2,
      dirty: false,
    });
  });

  test("a failed save stays marked and goes out on the next visit", async () => {
    restartWithDemo(NOW);
    const first = mount();
    await waitFor(() => expect(server.revision).toBe(1));
    failSaves = true;
    act(() => {
      saveCheckIn(checkIn, NOW);
    });
    await waitFor(() => expect(puts.length).toBeGreaterThan(1));
    expect(getCoachSync()?.dirty).toBe(true);
    first.unmount();
    failSaves = false;
    mount();
    await waitFor(() => expect(server.revision).toBe(2));
    expect(server.state?.checkIns.at(-1)?.date).toBe("2026-11-04");
  });

  test("someone else's week left in this browser is never saved to this account", async () => {
    restartWithDemo(NOW);
    saveCheckIn(checkIn, NOW);
    mount("jordan");
    await waitFor(() => expect(server.revision).toBe(1));
    cleanup();

    // Sam signs in on the same browser, with nothing saved yet.
    server = { state: null, revision: null };
    puts = [];
    mount("sam");
    // Gone before Sam's own copy has loaded, and the sample week has its badges.
    expect(getCoachState().checkIns.some((c) => c.date === "2026-11-04")).toBe(
      false,
    );
    expect(getCoachSync()?.owner).toBe("sam");
    expect(Object.keys(getCoachState().unlocked).length).toBeGreaterThan(0);
    await waitFor(() => expect(server.revision).toBe(1));
    expect(getCoachSync()?.owner).toBe("sam");
    expect(JSON.stringify(puts)).not.toContain('"2026-11-04"');
  });

  test("a school pack stays on this machine", async () => {
    window.localStorage.setItem(
      COACH_STORAGE_KEY,
      JSON.stringify({ ...demoState(NOW), source: "private" }),
    );
    resetCoachCache();
    expect(reconcileCoach("jordan", { state: null, revision: null })).toBe(
      false,
    );
    mount();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(puts).toHaveLength(0);
    expect(getCoachState().source).toBe("private");
  });
});
