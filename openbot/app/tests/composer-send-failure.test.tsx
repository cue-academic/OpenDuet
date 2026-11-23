import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "@/components/channels/composer/composer";
import { settleReactWork } from "./settle-react-work";

/**
 * WHAT A FAILED SEND DOES TO THE WORDS, WHICH UNTIL NOW COULD NOT BE ASKED AT ALL.
 *
 * `submitDraft` used to rethrow out of its own catch, and it has exactly two callers:
 * `handleFormSubmit`, which does `void submitDraft(value)`, and PromptArea's `onSubmit`, which
 * calls it and ignores the promise. Neither awaits and neither catches, so a failed send was an
 * unhandled rejection — which bun's runner reports as a failure of whichever test is running when
 * it surfaces. `composer-attachment-lifecycle.test.tsx` and `composer-queue-attachments.test.tsx`
 * each carry a note recording that they gave up on driving a failed send for exactly that reason.
 * They are the reason this file exists: with the rethrow gone the path is reachable, and these are
 * the two things it has to get right.
 *
 * THE HARNESS IS THIS REPOSITORY'S. `GlobalRegistrator` in `beforeAll`/`afterAll` and `cleanup` in
 * `afterEach`, matching `composer-paste.test.tsx` for the reason recorded there: bun walks every
 * file into one process, and a document another file tore down mid-run fails invisibly.
 */

const originalFetch = globalThis.fetch;
beforeAll(() => {
  GlobalRegistrator.register({ url: "http://localhost/" });
  globalThis.fetch = (async () =>
    Response.json({ agents: [], skills: [], tools: [] })) as never;
});
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  globalThis.fetch = originalFetch;
  GlobalRegistrator.unregister();
});

/** The editor inside the composer: the element the words actually live in. */
function editorOf(container: HTMLElement): HTMLElement {
  return container.querySelector("[contenteditable]") as HTMLElement;
}

/** What is typed in the box, with the placeholder and the strip left out of it. */
function typedText(container: HTMLElement): string {
  return editorOf(container).textContent ?? "";
}

test("an initially pending composer takes desktop focus and accepts a draft without enabling send", async () => {
  const matchMedia = window.matchMedia.bind(window);
  const pointer = spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = matchMedia(query);
    Object.defineProperty(result, "matches", {
      value: query === "(pointer: fine)",
    });
    return result;
  });
  try {
    const view = render(<Composer autoFocus compact pending />);
    const editor = editorOf(view.container);
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(editor.getAttribute("contenteditable")).toBe("true");
    const user = userEvent.setup({ document: editor.ownerDocument });
    await user.click(editor);
    await user.keyboard("A correction while you work.");
    expect(typedText(view.container)).toBe("A correction while you work.");
    expect(
      (view.getByRole("button", { name: "Send message" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(view.getByRole("status").textContent).toContain(
      "You can keep typing",
    );
    await user.keyboard("{Enter}");
    expect(typedText(view.container)).toBe("A correction while you work.");
  } finally {
    pointer.mockRestore();
  }
});

test.each([true, false])(
  "clicking composer padding focuses its editor (compact=%s)",
  (compact) => {
    const view = render(<Composer compact={compact} />);
    const editor = editorOf(view.container);
    expect(document.activeElement).not.toBe(editor);
    fireEvent.pointerDown(view.container.querySelector("form")!);
    expect(document.activeElement).toBe(editor);
    const send = view.getByRole("button", { name: "Send message" });
    editor.blur();
    fireEvent.pointerDown(send);
    expect(document.activeElement).not.toBe(editor);
  },
);

test("an accepted send clears immediately and keeps the next draft when it succeeds", async () => {
  const result = Promise.withResolvers<void>();
  const sent: string[] = [];
  const view = render(
    <Composer
      compact
      onSubmit={(draft) => {
        sent.push(draft.text);
        return result.promise;
      }}
    />,
  );
  const editor = editorOf(view.container);
  const user = userEvent.setup({ document: editor.ownerDocument });
  await user.click(editor);
  await user.keyboard("Explain quadratic equations.{Enter}");
  expect(sent).toEqual(["Explain quadratic equations."]);
  expect(typedText(view.container)).toBe("");
  expect(editor.getAttribute("contenteditable")).toBe("true");
  await user.keyboard("A follow-up.");
  await act(async () => {
    result.resolve();
    await result.promise;
  });
  expect(typedText(view.container)).toBe("A follow-up.");
  await user.clear(editor);
  await user.keyboard("{Enter}");
  expect(sent).toHaveLength(1);
});

/**
 * A send whose answer this test hands out by hand.
 *
 * The whole question is what happens BETWEEN the press and the failure, so `onSubmit` has to be a
 * promise the test still holds when it starts asking.
 */
function deferredSend() {
  let fail!: (error: Error) => void;
  const settled = new Promise<void>((_, reject) => {
    fail = reject;
  });
  return {
    onSubmit: () => settled,
    /** Fail the send, and let the composer's own `catch` and `finally` run before returning. */
    async reject() {
      fail(new Error("the turn could not be started"));
      await act(async () => {
        await settled.catch(() => undefined);
      });
    },
  };
}

/**
 * Type into the editor the one way this suite can: an ordinary text paste.
 *
 * The caret is not decoration — PromptArea inserts at the selection and gives up when there is not
 * one. A clipboard carrying text and no file is declined by the composer's own capture-phase
 * listener (`shouldClaimPaste` gives text the win), so this lands in the editor exactly as typing
 * would.
 */
function typeInto(container: HTMLElement, words: string) {
  const editor = editorOf(container);
  editor.focus();
  const caret = document.createRange();
  caret.selectNodeContents(editor);
  caret.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(caret);
  fireEvent.paste(editor, {
    clipboardData: {
      files: [],
      items: [],
      types: ["text/plain"],
      getData: (type: string) => (type === "text/plain" ? words : ""),
    },
  });
}

test("a failed send puts the words back rather than throwing at nobody", async () => {
  const send = deferredSend();
  const { container, getByLabelText } = render(
    <Composer compact initialValue="ship it" onSubmit={send.onSubmit} />,
  );

  await act(async () => {
    fireEvent.click(getByLabelText("Send message"));
  });
  // Cleared optimistically, which is the state the restore has to undo.
  expect(typedText(container)).toBe("");

  await send.reject();

  expect(typedText(container)).toContain("ship it");
  // Back to a composer that can be sent from again, rather than one stuck mid-send.
  expect((getByLabelText("Send message") as HTMLButtonElement).disabled).toBe(
    false,
  );
});

/**
 * THE EDITOR IS NEVER DISABLED MID-TURN, AND THAT IS DELIBERATE — it is how a correction gets typed
 * at a Bot that is already working. So by the time a send fails the box may well hold something
 * newer than the message that failed. `setValue(segments)` wrote straight over it: the failed
 * message came back and the sentence typed after it was gone, with nothing said about either.
 *
 * Both are somebody's words, so neither may be dropped. The restored ones go in FRONT of the newer
 * ones and the person edits the join.
 */
test("a failed send keeps what was typed while it was in flight", async () => {
  const send = deferredSend();
  const { container, getByLabelText } = render(
    <Composer compact initialValue="first" onSubmit={send.onSubmit} />,
  );

  await act(async () => {
    fireEvent.click(getByLabelText("Send message"));
  });
  expect(typedText(container)).toBe("");

  await act(async () => {
    typeInto(container, "second");
  });
  expect(typedText(container)).toContain("second");

  await send.reject();

  const restored = typedText(container);
  expect(restored).toContain("first");
  expect(restored).toContain("second");
  expect(restored.indexOf("first")).toBeLessThan(restored.indexOf("second"));
});
