import { expect, test } from "bun:test";
import {
  cueIsOff,
  HELP_LEVEL_LABEL,
  HELP_LEVELS,
  loosens,
  noStudyHelp,
  parseHelpLevel,
  stricterLevel,
} from "./study";

test("there are four levels, from Study to Test, each stricter than the last", () => {
  expect(HELP_LEVELS.map((level) => HELP_LEVEL_LABEL[level])).toEqual([
    "Study",
    "Guided help",
    "On your own",
    "Test",
  ]);
  expect(stricterLevel("none", "test")).toBe("test");
  expect(loosens("test", "none")).toBe(true);
  expect(loosens("none", "test")).toBe(false);
});

test("a notice's words read as their level, the earlier words included", () => {
  const read = (words: string) => parseHelpLevel(words);
  expect(["Study", "Guided help", "On your own", "Test"].map(read)).toEqual([
    "full",
    "hints",
    "none",
    "test",
  ]);
  expect(
    ["Full help", "Hints only.", "No help", "No AI help"].map(read),
  ).toEqual(["full", "hints", "none", "none"]);
  expect(read("Test. AI tools are off for this test.")).toBe("test");
  // "test" and "study" are ordinary words: only the start of the line names a level.
  expect(read("Guided help while you study for the test")).toBe("hints");
  expect(read("ask Mr. Chen")).toBeNull();
});

test("On your own and Test stop study help; only Test stops planning", () => {
  expect(HELP_LEVELS.filter(noStudyHelp)).toEqual(["none", "test"]);
  expect(HELP_LEVELS.filter(cueIsOff)).toEqual(["test"]);
});
