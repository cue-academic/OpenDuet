import { describe, expect, test } from "bun:test";
import {
  ASSIGNMENTS_TOOL,
  type SchoolAssignment,
  type SchoolSnapshot,
} from "@openbot/shared/study";
import type {
  SchoolService,
  StudyToolDeps,
} from "../src/openduet/study/contracts";
import { hubTools } from "../src/openduet/study/hub-tools";
import { createMemoryStudyStore } from "../src/openduet/study/memory-store";
import { createRulesService } from "../src/openduet/study/rules";

/**
 * list_assignments over the demo student's stored classes: what is still to do, soonest first, with
 * each due date in their zone and the help level in force; one class by name; everything on request;
 * and what it says before any classes are stored. No Gmail is read: the Classroom reader is a fake.
 */

/** Wednesday, November 4, 2026, 9:00 AM in Chicago. */
const NOW = new Date("2026-11-04T15:00:00.000Z");

function work(
  fields: Pick<SchoolAssignment, "id" | "classId" | "title"> &
    Partial<SchoolAssignment>,
): SchoolAssignment {
  return {
    kind: "assignment",
    status: "open",
    due: null,
    dueDate: null,
    dueTime: null,
    points: null,
    grade: null,
    help: null,
    minutes: 30,
    link: null,
    noticeId: `notice-${fields.id}`,
    ...fields,
  };
}

/** Jordan Rivera's sample classes, as scripts/fake-google's Classroom notices give them. */
const SNAPSHOT: SchoolSnapshot = {
  syncedAt: "2026-11-04T14:55:00.000Z",
  timeZone: "America/Chicago",
  classes: [
    {
      id: "apush1",
      name: "AP US History",
      teacher: "Mr. Grant",
      period: "Period 1",
      color: "sky",
    },
    {
      id: "chem2",
      name: "Chemistry",
      teacher: "Dr. Okoro",
      period: "Period 2",
      color: "violet",
    },
    {
      id: "precalc4",
      name: "Precalculus",
      teacher: "Mr. Chen",
      period: "Period 4",
      color: "amber",
    },
  ],
  assignments: [
    work({
      id: "precalc4-hw43",
      classId: "precalc4",
      title: "Section 4.3 homework",
      status: "missing",
      due: "2026-11-04T05:59:00.000Z",
      help: "full",
      minutes: 45,
      points: 20,
    }),
    work({
      id: "precalc4-quiz4",
      classId: "precalc4",
      title: "Unit 4 quiz: Trig identities",
      kind: "quiz",
      due: "2026-11-05T16:45:00.000Z",
      help: "full",
      minutes: 60,
    }),
    work({
      id: "chem2-lab6",
      classId: "chem2",
      title: "Lab 6 report: Reaction Rates",
      due: "2026-11-06T05:59:00.000Z",
      help: "hints",
      minutes: 90,
    }),
    work({
      id: "apush1-dbq3",
      classId: "apush1",
      title: "DBQ essay: Causes of the Civil War",
      due: "2026-11-06T14:00:00.000Z",
      help: "none",
      minutes: 120,
    }),
    work({
      id: "apush1-dbqdocs",
      classId: "apush1",
      title: "DBQ documents and rubric",
      kind: "material",
      help: "none",
      minutes: 0,
    }),
    work({
      id: "chem2-lab5",
      classId: "chem2",
      title: "Lab 5 report: Concentration and Rate",
      status: "returned",
      grade: "34/40",
      minutes: 90,
    }),
  ],
  couldNotRead: [],
};

function setup(
  snapshot: SchoolSnapshot | null = SNAPSHOT,
  why: string | null = null,
) {
  const store = createMemoryStudyStore({ now: () => NOW });
  const school: SchoolService = {
    current: async () => ({ snapshot, why }),
    stored: async () => snapshot,
  };
  const deps: StudyToolDeps = {
    actorId: "jordan",
    botId: "academic-os",
    initiator: { kind: "person" },
    store,
    school,
    rules: createRulesService({ store, now: () => NOW }),
    callTool: async () => {
      throw new Error("list_assignments calls no connector.");
    },
    now: () => NOW,
  };
  const [tool] = hubTools(deps);
  if (!tool) throw new Error("no tool");
  const call = async (args: unknown) =>
    JSON.parse(String(await tool.execute(args))) as Record<string, unknown>;
  return { tool, call, deps };
}

type Listed = {
  class: string;
  title: string;
  status: string;
  dueLocal: string | null;
  overdue: boolean;
  help: string;
  helpLevel: string;
  helpSetBy: string;
  points: number | null;
};

describe("list_assignments", () => {
  test("is named for the Bot and only reads", () => {
    const { tool } = setup();
    expect(tool.name).toBe(ASSIGNMENTS_TOOL);
    expect(tool.ref).toBe("openduet/list_assignments");
  });

  test("lists work still to do, soonest due first, with the level in force", async () => {
    const { call } = setup();
    const result = await call({});
    expect(result.timeZone).toBe("America/Chicago");
    const listed = result.assignments as Listed[];
    expect(listed.map((row) => row.title)).toEqual([
      "Section 4.3 homework",
      "Unit 4 quiz: Trig identities",
      "Lab 6 report: Reaction Rates",
      "DBQ essay: Causes of the Civil War",
    ]);
    expect(listed[0]).toMatchObject({
      class: "Precalculus",
      status: "missing",
      overdue: true,
      dueLocal: "Tue, Nov 3, 11:59 PM",
      help: "Full help",
      helpLevel: "full",
      helpSetBy: "notice",
      points: 20,
    });
    expect(listed[3]).toMatchObject({
      class: "AP US History",
      overdue: false,
      dueLocal: "Fri, Nov 6, 8:00 AM",
      help: "No help",
    });
    expect(result.classes).toEqual([
      {
        name: "AP US History",
        teacher: "Mr. Grant",
        period: "Period 1",
        helpLevel: "none",
        help: "No help",
      },
      {
        name: "Chemistry",
        teacher: "Dr. Okoro",
        period: "Period 2",
        helpLevel: "hints",
        help: "Hints only",
      },
      {
        name: "Precalculus",
        teacher: "Mr. Chen",
        period: "Period 4",
        helpLevel: "full",
        help: "Full help",
      },
    ]);
  });

  test("shows the level a student set on Teacher rules", async () => {
    const { call, deps } = setup();
    await deps.rules.change(
      "jordan",
      { assignments: { "chem2-lab6": "none" } },
      { canLoosen: false, snapshot: SNAPSHOT, now: NOW },
    );
    const listed = (await call({ class: "chemistry" })).assignments as Listed[];
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      title: "Lab 6 report: Reaction Rates",
      help: "No help",
      helpSetBy: "override",
    });
  });

  test("include all adds returned work and materials", async () => {
    const { call } = setup();
    const listed = (await call({ class: "", include: "all" }))
      .assignments as Listed[];
    expect(listed).toHaveLength(6);
    expect(listed.map((row) => row.title)).toContain(
      "Lab 5 report: Concentration and Rate",
    );
  });

  test("names the classes when the one asked for isn't theirs", async () => {
    const { call } = setup();
    expect(await call({ class: "Biology" })).toEqual({
      error: "\"Biology\" isn't one of the student's classes.",
      classes: ["AP US History", "Chemistry", "Precalculus"],
    });
  });

  test("says why when no classes are stored", async () => {
    const why = "Gmail isn't connected yet.";
    expect(await setup(null, why).call({})).toEqual({ error: why });
    expect((await setup(null).call({})).error).toContain(
      "No classes are stored",
    );
  });
});
