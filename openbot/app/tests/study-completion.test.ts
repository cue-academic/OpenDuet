import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
  invalidateStudyCompletion,
  studyOverviewQueryOptions,
} from "@/lib/learn/queries";
import { studyKeys } from "@/lib/study/keys";

test("completion refreshes Learn memory and every class's progress only", async () => {
  const client = new QueryClient();
  const overviewKey = studyOverviewQueryOptions().queryKey;
  const refreshed = [
    overviewKey,
    studyKeys.progress(null),
    studyKeys.progress("chem2"),
  ];
  const untouched = [studyKeys.deck("deck-1"), ["unrelated"]];
  try {
    for (const key of [...refreshed, ...untouched]) {
      client.setQueryData(key, {});
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }

    await invalidateStudyCompletion(client);

    for (const key of refreshed) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
    for (const key of untouched) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
  } finally {
    client.clear();
  }
});

test("completion with no cached study data does not create queries", async () => {
  const client = new QueryClient();
  try {
    await invalidateStudyCompletion(client);
    expect(client.getQueryCache().getAll()).toEqual([]);
  } finally {
    client.clear();
  }
});
