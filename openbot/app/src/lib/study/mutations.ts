import type { StudyPlan, TonightSample } from "@openbot/shared/study";
import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { studyKeys } from "./keys";

type TonightPlanInput = {
  skip: string[];
  minutes: number;
  save?: true;
  planId?: string | null;
  sample?: TonightSample;
};

type TonightPlanResult = {
  planId: string | null;
  plan: Pick<StudyPlan, "blocks" | "remaining" | "warnings"> & {
    summary: string;
  };
};

export function planTonightMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (body: TonightPlanInput): Promise<TonightPlanResult> => {
      const response = await client("/api/openduet/study/workshop/tonight", {
        method: "POST",
        body,
        fallback: "Couldn't make a plan for tonight.",
      });
      return response.json();
    },
    onSuccess: ({ planId }) => {
      if (!planId) return;
      return queryClient.invalidateQueries({ queryKey: studyKeys.calendarAll });
    },
  });
}
