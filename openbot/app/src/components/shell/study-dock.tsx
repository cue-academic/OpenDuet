import { type MouseEvent, useEffect, useState } from "react";
import { DuetIcon, type DuetIconName } from "@/components/duet/icons";

/**
 * The daily tools, opened from chat. Chat stays the home; each one is a screen
 * beside it. Plain links, so a conversation drawn without the app router
 * (tests, a channel on its own page) still renders. A normal click asks the
 * shell to open the screen without reloading the chat.
 */
const TOOLS = [
  {
    label: "Tonight",
    icon: "moon",
    to: "/coach",
    about: "What to do next, and for how long",
  },
  { label: "Study", icon: "deck", to: "/learn", about: "Review and practice" },
  {
    label: "Classes",
    icon: "layout",
    to: "/classes",
    about: "What's due in each class",
  },
  {
    label: "Calendar",
    icon: "calendar",
    to: "/calendar",
    about: "Your day and week",
  },
  {
    label: "Tasks",
    icon: "tasks",
    to: "/tasks",
    about: "What Cue is working on",
  },
  {
    label: "Rules",
    icon: "shield",
    to: "/settings/teacher-rules",
    about: "Each teacher's AI rules",
  },
  { label: "Made", icon: "page", to: "/make", about: "Your notes and decks" },
] as const satisfies readonly {
  label: string;
  icon: DuetIconName;
  to: string;
  about: string;
}[];

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

function HubBoard() {
  return (
    <nav aria-label="Study tools" className="mt-6 pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
        {TOOLS.map((tool) => (
          <a
            className="flex min-h-16 items-center gap-3 border-duet-hair border-b px-2 py-3 text-duet-ink transition-colors last:border-b-0 hover:bg-duet-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-duet-accent lg:last:col-span-2"
            href={tool.to}
            key={tool.to}
            onClick={(event) => openTool(event, tool.to)}
          >
            <DuetIcon
              name={tool.icon}
              size={18}
              className="shrink-0 text-duet-ink-3"
            />
            <span className="min-w-0">
              <span className="type-sub block font-medium">{tool.label}</span>
              <span className="type-caption block truncate text-duet-ink-3">
                {tool.about}
              </span>
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
    <nav aria-label="Study tools" className="my-4 flex flex-wrap gap-1.5 pb-1">
      {TOOLS.map((tool) => {
        const current = path === tool.to || path.startsWith(`${tool.to}/`);
        return (
          <a
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "type-caption inline-flex min-h-11 items-center rounded-[10px] bg-duet-black px-3 font-semibold text-duet-on-black transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 active:scale-[0.97] motion-reduce:active:scale-100"
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
