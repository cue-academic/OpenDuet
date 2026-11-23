import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { Message } from "@ag-ui/core";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup, render } from "@testing-library/react";
import { ConversationView } from "@/components/channels/conversation-view";
import { ChatPresenceProvider } from "@/components/shell/chat-presence";
import { StudyDock } from "@/components/shell/study-dock";
import { firstDayGreeting } from "@/lib/channels/first-day";
import { settleReactWork } from "./settle-react-work";

/**
 * A turn that ended without an answer is said where the person is looking: at the end of the
 * conversation, or, in Chat with nothing in it yet, under its question and over the box.
 */

beforeAll(() => {
  GlobalRegistrator.register({ url: "http://localhost/" });
  // The composer asks what this install can do (dictation); nothing here is on.
  global.fetch = (async () =>
    Response.json({ user: null })) as unknown as typeof fetch;
});
afterEach(() => cleanup());
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const FAILED =
  "Couldn't reach your coach. Check your connection and try again.";

function Chat({
  messages = [],
  stopped = FAILED,
}: {
  messages?: Message[];
  stopped?: string;
}) {
  return (
    <ChatPresenceProvider>
      <ConversationView
        inShell
        messages={messages}
        notice={<StudyDock />}
        onSubmit={() => {}}
        stopped={stopped}
      />
    </ChatPresenceProvider>
  );
}

test("in an empty Chat, a failure is said under the question, just over the box", () => {
  const view = render(<Chat />);
  const alert = view.getByRole("alert");
  expect(alert.textContent).toBe(FAILED);
  expect(view.queryByTestId("transcript-stopped")).toBeNull();
  const question = view.getByRole("heading", {
    name: "What are we working on?",
  });
  const box = view.getByRole("textbox", { name: "Message" });
  // In reading order: the question, the failure, then the box.
  expect(
    question.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    alert.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("the empty hub has one heading, tabs, and composer", () => {
  const view = render(<Chat stopped="" />);
  expect(view.getAllByRole("heading")).toHaveLength(1);
  const heading = view.getByRole("heading", {
    name: "What are we working on?",
  });
  const tabs = view.getByRole("navigation", { name: "Study tools" });
  const composer = view.getByRole("textbox", { name: "Message" });
  expect(view.queryByRole("alert")).toBeNull();
  expect(
    heading.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    tabs.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("welcome messages replace the empty heading and precede the tabs and composer", () => {
  const view = render(
    <Chat
      stopped=""
      messages={[
        { id: "welcome", role: "user", content: firstDayGreeting("with_mail") },
      ]}
    />,
  );
  expect(
    view.queryByRole("heading", { name: "What are we working on?" }),
  ).toBeNull();
  const welcome = view.getByText(/It's our first day together/);
  expect(view.getByText(/I'm going to check your recent mail/)).toBeTruthy();
  const tabs = view.getByRole("navigation", { name: "Study tools" });
  const composer = view.getByRole("textbox", { name: "Message" });
  expect(
    welcome.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    tabs.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("in a conversation, it stays at the end of the transcript", () => {
  const view = render(
    <Chat messages={[{ id: "m1", role: "user", content: "What's due?" }]} />,
  );
  expect(view.getByRole("alert").textContent).toBe(FAILED);
  expect(view.getByTestId("transcript-stopped").textContent).toBe(FAILED);
  expect(view.queryByRole("heading", { name: "What are we working on?" })).toBe(
    null,
  );
});
