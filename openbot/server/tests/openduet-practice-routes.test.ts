import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { craftRoutes } from "../src/openduet/study/craft-routes";
import { createMemoryStudyStore } from "../src/openduet/study/memory-store";
import { mountStudyRoutes } from "../src/openduet/study/routes";

const unused = async (): Promise<never> => {
  throw new Error("not used");
};

for (const failure of ["pack disabled", "class removed"]) {
  test(`practice grading can retry after ${failure}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "practice-routes-"));
    const savedFlag = process.env.ACADEMIC_OS_PRIVATE_DEMO;
    const savedDir = process.env.ACADEMIC_OS_DATA_DIR;
    const classes = (present: boolean) => {
      writeFileSync(
        join(root, "classes.json"),
        JSON.stringify({
          classes: present
            ? [
                {
                  id: "history",
                  name: "History",
                  status: "Current",
                  materials: [],
                },
              ]
            : [{ id: "math", name: "Math", status: "Current", materials: [] }],
        }),
      );
    };
    try {
      classes(failure !== "class removed");
      writeFileSync(
        join(root, "assignments_and_tests.json"),
        JSON.stringify({ current_term_2026_2027: [] }),
      );
      process.env.ACADEMIC_OS_DATA_DIR = root;
      process.env.ACADEMIC_OS_PRIVATE_DEMO =
        failure === "pack disabled" ? "0" : "1";
      const store = createMemoryStudyStore();
      await store.insertOnce("member", {
        id: "practice",
        kind: "practice",
        botId: "primary",
        classId: "history",
        data: {
          title: "Period 5 quiz",
          classId: "history",
          className: "History",
          focus: "Period 5",
          subject: "history",
          mode: "quiz",
          suggestedMinutes: 5,
          createdAt: "2026-11-04T15:00:00.000Z",
          result: null,
          items: [
            {
              id: "q1",
              kind: "mcq",
              prompt: "When was the Emancipation Proclamation issued?",
              choices: ["1860", "1861", "1862", "1863"],
              answerIndex: 3,
              answer: "1863",
              rubric: [],
              topic: "Period 5",
              points: 1,
            },
          ],
        },
      });
      const app = new Hono().route(
        "/study",
        mountStudyRoutes(
          [
            craftRoutes({
              store,
              primaryBot: "primary",
              school: { current: unused, stored: unused },
              rules: {
                overrides: unused,
                change: unused,
                view: unused,
                target: unused,
              },
              callTool: unused,
              upNext: unused,
            }),
          ],
          async (context, next) => {
            context.set("actor", {
              id: "member",
              email: "member@example.com",
              role: "user",
            });
            await next();
          },
        ),
      );
      const grade = () =>
        app.request("/study/workshop/practice/practice/grade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: [{ id: "q1", choice: 3 }] }),
        });
      const failed = await grade();
      expect(failed.status).toBe(400);
      expect(await failed.json()).toEqual({
        error:
          failure === "pack disabled"
            ? "Add your class notes under data/private, then try again."
            : "Pick one of your classes: Math.",
      });
      expect(
        (await store.get("member", "practice", "practice"))?.data.grading,
      ).not.toBe(true);
      process.env.ACADEMIC_OS_PRIVATE_DEMO = "1";
      classes(true);
      const retried = await grade();
      expect(retried.status).toBe(200);
      expect((await retried.json()).result).toMatchObject({
        earned: 1,
        points: 1,
      });
      const record = await store.get("member", "practice", "practice");
      expect(record?.data.grading).toBe(false);
      expect(record?.data.result).toMatchObject({ earned: 1, points: 1 });
    } finally {
      if (savedFlag === undefined) delete process.env.ACADEMIC_OS_PRIVATE_DEMO;
      else process.env.ACADEMIC_OS_PRIVATE_DEMO = savedFlag;
      if (savedDir === undefined) delete process.env.ACADEMIC_OS_DATA_DIR;
      else process.env.ACADEMIC_OS_DATA_DIR = savedDir;
      rmSync(root, { recursive: true, force: true });
    }
  });
}
