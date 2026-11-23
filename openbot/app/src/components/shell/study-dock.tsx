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
  },
  { label: "Study", to: "/learn" },
  {
    label: "Classes",
    to: "/classes",
  },
  {
    label: "Calendar",
    to: "/calendar",
  },
  {
    label: "Tasks",
    to: "/tasks",
  },
  {
    label: "Rules",
    to: "/settings/teacher-rules",
  },
  { label: "Made", to: "/make" },
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
    const fromBar = () => setPath(here());
    window.addEventListener("academic-os-navigated", fromBar);
    window.addEventListener("popstate", fromBar);
    return () => {
      window.removeEventListener("academic-os-navigated", fromBar);
      window.removeEventListener("popstate", fromBar);
    };
  }, []);
  return path;
}

export function StudyDock() {
  const path = usePath();
  return (
    <nav
      aria-label="Study tools"
      className="mb-2 flex flex-nowrap gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TOOLS.map((tool) => {
        const current = path === tool.to || path.startsWith(`${tool.to}/`);
        return (
          <a
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "type-caption inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-duet-accent border-b-2 font-medium text-duet-ink focus-visible:outline-offset-[-2px] focus-visible:outline-duet-accent"
                : "type-caption inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-duet-ink-3 hover:text-duet-ink focus-visible:outline-offset-[-2px] focus-visible:outline-duet-accent"
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
