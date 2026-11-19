import { useRenderTool } from "@copilotkit/react-core/v2";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { DuetCard } from "@/components/duet/kit";
import { PracticeSession } from "@/components/learn/practice-session";
import { ToolLine } from "@/components/channels/tool-line";
import { invalidateStudyCompletion } from "@/lib/learn/queries";
import { readToolResult } from "@/lib/study/schemas";
import {
  gradePractice,
  loadPractice,
  type PracticePaper,
} from "@/lib/study/practice";

/**
 * The notes quiz from make_notes_quiz, drawn under the Bot's sentence.
 * The card loads the paper by id, so the answer key never travels in the tool result.
 */

const resultSchema = z.object({
  kind: z.literal("practice"),
  id: z.string(),
  title: z.string(),
  className: z.string(),
  count: z.number(),
  mode: z.enum(["quiz", "test"]),
});

export function PracticeCardTool() {
  useRenderTool({
    name: "make_notes_quiz",
    parameters: z.object({
      class: z.string().optional(),
      focus: z.string().optional(),
      mode: z.string().optional(),
    }),
    render: ({ result }) => <PracticeTool result={result} />,
  });
  return null;
}

function PracticeTool({ result }: { result: unknown }) {
  const parsed = readToolResult(result, resultSchema);
  if (!parsed)
    return (
      <ToolLine
        label={
          result === undefined ? "Making your quiz" : "Couldn't make your quiz"
        }
        running={result === undefined}
        failed={result !== undefined}
      />
    );
  return <Loaded id={parsed.id} />;
}

function Loaded({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const paper = useQuery({
    queryKey: ["practice", id],
    queryFn: () => loadPractice(id),
  });
  if (!paper.data)
    return (
      <ToolLine
        label={paper.isError ? "Couldn't load your quiz" : "Loading your quiz"}
        running={!paper.isError}
        failed={paper.isError}
      />
    );
  return (
    <DuetCard className="px-4 py-4">
      <PracticeSession
        paper={paper.data}
        busy={busy}
        onGrade={async (answers) => {
          setBusy(true);
          try {
            const graded = await gradePractice(id, answers);
            const next: PracticePaper = { ...paper.data, result: graded };
            queryClient.setQueryData(["practice", id], next);
            void invalidateStudyCompletion(queryClient);
            return graded;
          } finally {
            setBusy(false);
          }
        }}
      />
    </DuetCard>
  );
}
