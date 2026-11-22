import { type MouseEvent, useEffect, useState } from "react";

/**
 * The daily tools, opened from chat. Chat stays the home; each one is a screen
 * beside it. Plain links, so a conversation drawn without the app router
 * (tests, a channel on its own page) still renders. A normal click asks the
 * shell to open the screen without reloading the chat.
 */
const TOOLS = [
  {
    label: "Tonight",
    to: "/coach",
    about: "What to do next, and for how long",
  },
  { label: "Study", to: "/learn", about: "Review, flashcards and practice" },
  { label: "Classes", to: "/classes", about: "What's due in each class" },
  { label: "Calendar", to: "/calendar", about: "Your day and week" },
  { label: "Tasks", to: "/tasks", about: "What Cue is working on" },
  {
    label: "Rules",
    to: "/settings/teacher-rules",
    about: "How much AI help is allowed",
  },
  { label: "Made", to: "/make", about: "Notes and decks made for you" },
] as const;

function here(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function openTool(event: MouseEvent<HTMLAnchorElement>, to: string) {
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }
  event.preventDefault();
  window.dispatchEvent(new CustomEvent("academic-os-open", { detail: to }));
}

function usePath(): string {
  const [path, setPath] = useState(here);
  useEffect(() => {
    const fromClick = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string") {
        setPath(detail.replace(/\/+$/, "") || "/");
      }
    };
    const fromBar = () => setPath(here());
    window.addEventListener("academic-os-open", fromClick);
    window.addEventListener("academic-os-navigated", fromBar);
    window.addEventListener("popstate", fromBar);
    return () => {
      window.removeEventListener("academic-os-open", fromClick);
      window.removeEventListener("academic-os-navigated", fromBar);
      window.removeEventListener("popstate", fromBar);
    };
  }, []);
  return path;
}

/**
 * The hub: with no screen open, the tools are a numbered board under the day's date instead of a
 * row of chips, so the first thing on `/` is where to go, not an empty chat.
 */
function HubBoard() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <nav aria-label="Study tools" className="mb-3">
      <p className="cue-label text-duet-ink-3">{today}</p>
      <p className="study-display mt-1 mb-3 text-[1.75rem] text-duet-ink leading-[2rem]">
        Pick up where <span className="cue-mark">you left off.</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TOOLS.map((tool, index) => (
          <a
            className="group flex min-h-[84px] flex-col justify-between rounded-[var(--duet-radius-card)] bg-duet-card p-3 shadow-duet-card transition-[transform,background-color] first:bg-duet-black first:text-duet-on-black hover:bg-duet-accent-soft first:hover:bg-duet-black first:hover:brightness-125 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 active:scale-[0.98] motion-reduce:active:scale-100"
            href={tool.to}
            key={tool.to}
            onClick={(event) => openTool(event, tool.to)}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="study-display type-nav">{tool.label}</span>
              <span
                aria-hidden
                className="cue-label text-duet-ink-3 group-first:text-duet-highlight"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </span>
            <span className="type-caption mt-2 text-duet-ink-2 group-first:text-duet-on-black/80">
              {tool.about}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export function StudyDock() {
  const path = usePath();
  if (path === "/") return <HubBoard />;
  return (
    <nav aria-label="Study tools" className="mb-2 flex flex-wrap gap-1.5 pb-1">
      {TOOLS.map((tool) => {
        const current = path === tool.to || path.startsWith(`${tool.to}/`);
        return (
          <a
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "type-caption inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-duet-black px-3 font-semibold text-duet-on-black transition-transform before:size-1.5 before:rounded-full before:bg-duet-highlight focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 active:scale-[0.97] motion-reduce:active:scale-100"
                : "type-caption inline-flex min-h-11 items-center rounded-[10px] bg-duet-card px-3 font-semibold text-duet-ink shadow-duet-card transition-[transform,background-color,color] hover:bg-duet-accent-soft hover:text-duet-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 active:scale-[0.97] motion-reduce:active:scale-100"
            }
            href={tool.to}
            key={tool.to}
            onClick={(event) => openTool(event, tool.to)}
          >
            {tool.label}
          </a>
        );
      })}
    </nav>
  );
}
