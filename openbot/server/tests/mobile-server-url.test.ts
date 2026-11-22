import { expect, test } from "bun:test";
import { readServerUrl } from "../../mobile/src/server-url";

test("a missing or bad native server URL is reported instead of thrown", () => {
  for (const value of [undefined, "", "   "])
    expect(readServerUrl(value, false).problem).toContain(
      "EXPO_PUBLIC_SERVER_URL",
    );
  expect(readServerUrl("not a url", true).problem).toContain("not a valid URL");
  expect(readServerUrl("http://openbot.example.com", false).problem).toContain(
    "HTTPS",
  );
  for (const value of [
    "https://user:pass@openbot.example.com",
    "https://openbot.example.com/?a=1",
    "https://openbot.example.com/#x",
  ])
    expect(readServerUrl(value, false).problem).toContain(
      "without credentials",
    );
});

test("a valid native server URL resolves to its origin", () => {
  expect(readServerUrl("https://openbot.example.com/app/", false)).toEqual({
    origin: "https://openbot.example.com",
    host: "openbot.example.com",
  });
  expect(readServerUrl(" http://localhost:3001 ", true)).toEqual({
    origin: "http://localhost:3001",
    host: "localhost:3001",
  });
});
