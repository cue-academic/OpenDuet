import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { craftRoutes } from "../src/openduet/study/craft-routes";
import { createMemoryStudyStore } from "../src/openduet/study/memory-store";
import { mountStudyRoutes } from "../src/openduet/study/routes";
import { createRulesService } from "../src/openduet/study/rules";

const root = mkdtempSync(join(tmpdir(), "guide-focus-"));
const keys = [
  "ACADEMIC_OS_PRIVATE_DEMO",
  "ACADEMIC_OS_DATA_DIR",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
] as const;
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

beforeAll(() => {
  process.env.ACADEMIC_OS_PRIVATE_DEMO = "1";
  process.env.ACADEMIC_OS_DATA_DIR = root;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  writeFileSync(
    join(root, "classes.json"),
    JSON.stringify({
      timezone: "America/Chicago",
      school: "Example",
      classes: [
        {
          id: "history",
          name: "History",
          status: "Current",
          materials: ["period-4.md", "period-5.md"],
        },
      ],
    }),
  );
  writeFileSync(
    join(root, "assignments_and_tests.json"),
    JSON.stringify({
      current_term_2026_2027: [
        {
          name: "Essay",
          class_id: "history",
          type: "homework",
          due: "2026-11-11",
        },
      ],
    }),
  );
  writeFileSync(
    join(root, "period-4.md"),
    "# Period 4\n\n## Slavery and the West\n\n**Missouri Compromise** — The 1820 agreement balanced free and slave states in the Senate.\n",
  );
  writeFileSync(
    join(root, "period-5.md"),
    "# Period 5\n\n## The Civil War\n\n**Emancipation Proclamation** — Lincoln's 1863 order freed enslaved people in Confederate-held territory.\n",
  );
});

afterAll(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  rmSync(root, { recursive: true, force: true });
});

function setup() {
  const store = createMemoryStudyStore();
  const routes = craftRoutes({
    store,
    rules: createRulesService({ store }),
    school: {
      current: async () => ({ snapshot: null, why: null }),
      stored: async () => null,
    },
    callTool: async () => {
      throw new Error("Unexpected connector call");
    },
    upNext: async () => [],
    primaryBot: "academic-os",
  });
  const app = new Hono().route(
    "/study",
    mountStudyRoutes([routes], async (context, next) => {
      context.set("actor", {
        id: "student",
        email: "student@example.com",
        role: "user",
      });
      await next();
    }),
  );
  return async (focus?: string) => {
    const response = await app.request("/study/workshop/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: "history", focus }),
    });
    expect(response.status).toBe(200);
    return response.json() as Promise<{ title: string; markdown: string }>;
  };
}

test("workshop guides retain free-text period focus and select matching notes", async () => {
  const guide = setup();
  const period4 = await guide("Period 4");
  const period5 = await guide("Period 5");
  expect(period4.title).toContain("Period 4");
  expect(period5.title).toContain("Period 5");
  expect(period4.markdown).not.toBe(period5.markdown);
  expect(period4.markdown).toContain("Missouri Compromise");
  expect(period4.markdown).not.toContain("Emancipation");
  expect(period5.markdown).toContain("Emancipation");
  expect(period5.markdown).not.toContain("Missouri Compromise");
});

test("assignment and absent focus still use the upcoming assignment", async () => {
  const guide = setup();
  const assignment = await guide("Essay");
  expect(assignment.markdown).toContain("Essay");
  expect(await guide()).toEqual(assignment);
  expect(await guide("")).toEqual(assignment);
});

test("an unknown focus is retained instead of silently becoming class-wide", async () => {
  const guide = await setup()("Reconstruction");
  expect(guide.title).toContain("Reconstruction");
  expect(guide.markdown).toContain("Reconstruction");
});
