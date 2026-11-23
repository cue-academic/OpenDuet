import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";

/**
 * WHETHER A SCREEN IS DRAWN OVER THE CHAT. In a window narrower than the shell's `lg`, Tasks,
 * Calendar and the other screens cover the chat instead of opening beside it, and the chat stays
 * mounted underneath, out of sight. Chat asks this before it takes the caret on its own, so nothing
 * typed goes into a box nobody can see.
 */
const Covered = createContext(false);

/** A screen is open over the chat, so the chat can't be seen. False outside the shell. */
export function useChatCovered(): boolean {
  return useContext(Covered);
}

/** Around the chat: `screen` says a screen is open, and the window's width says where. */
export function ChatCover({
  hidden = false,
  screen,
  children,
}: {
  hidden?: boolean;
  screen: boolean;
  children: ReactNode;
}) {
  const wide = useSyncExternalStore(onWidthChange, isWide);
  const covered = hidden || (screen && !wide);
  return (
    <Covered.Provider value={covered}>
      <div className="flex min-h-0 flex-1 flex-col" inert={covered}>
        {children}
      </div>
    </Covered.Provider>
  );
}

/** Wide enough that a screen opens beside the chat: the shell's `lg` (`startup-intro.tsx` asks too). */
const WIDE = "(min-width: 64rem)";

function isWide(): boolean {
  return window.matchMedia?.(WIDE).matches === true;
}

function onWidthChange(changed: () => void): () => void {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener("change", changed);
  return () => query?.removeEventListener("change", changed);
}
