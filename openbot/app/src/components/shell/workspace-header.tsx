import { IconDots } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { appConfig } from "@/lib/generated/application-config";
import { cn } from "@/lib/utils";
import { ChatOrb, ChatStep, initialOf } from "./header";
import { INTRO_NAME_TARGET } from "./startup-intro";
import type { ShellTab } from "./tab-bar";

const SECTIONS = [
  { tab: "today", label: "Today", to: "/" },
  { tab: "coach", label: "Coach", to: "/coach" },
  { tab: "classes", label: "Classes", to: "/classes" },
  { tab: "calendar", label: "Calendar", to: "/calendar" },
  { tab: "chat", label: "Chat", to: "/chat" },
] as const;

const STUDY_TOOLS = [
  { label: "Study", to: "/learn" },
  { label: "Tasks", to: "/tasks" },
  { label: "Teacher rules", to: "/settings/teacher-rules" },
  { label: "Made for you", to: "/make" },
] as const;

export function WorkspaceHeader({ tab }: { tab: ShellTab }) {
  const { data: user } = useQuery(currentUserQueryOptions());
  return (
    <header className="duet-face z-40 shrink-0 border-duet-hair border-b bg-duet-card text-duet-ink">
      <div className="mx-auto grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 pt-2 pb-2 sm:px-8 lg:h-[4.25rem] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-10 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            activeOptions={{ exact: true }}
            activeProps={{ "aria-current": undefined }}
            aria-label={`${appConfig.brand.productName} home`}
            className="flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40"
            to="/"
          >
            <ChatOrb size={34} />
            <span
              className={`${INTRO_NAME_TARGET} cue-editorial text-[1.65rem] leading-none`}
            >
              {appConfig.brand.productName}
            </span>
          </Link>
          <div className="min-w-0">
            <ChatStep />
          </div>
        </div>
        <nav
          aria-label="Study workspace"
          className="col-span-2 row-start-2 flex min-w-0 overflow-x-auto rounded-full bg-duet-tile/55 p-0.5 [scrollbar-width:none] lg:col-span-1 lg:row-start-auto"
        >
          {SECTIONS.map((section) => {
            const current = tab === section.tab;
            return (
              <Link
                activeOptions={{ exact: true }}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-max flex-1 items-center justify-center rounded-full px-2 font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-duet-accent focus-visible:outline-offset-[-2px] sm:px-4",
                  current
                    ? "bg-duet-accent-soft text-duet-accent"
                    : "text-duet-ink-2 hover:bg-duet-card hover:text-duet-ink",
                )}
                key={section.tab}
                to={section.to}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 justify-self-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More study tools"
              className="grid size-11 place-items-center rounded-full text-duet-ink-2 transition-colors hover:bg-duet-tile focus-visible:outline-2 focus-visible:outline-duet-accent"
              title="More study tools"
            >
              <IconDots aria-hidden size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {STUDY_TOOLS.map((tool) => (
                <DropdownMenuItem
                  className="min-h-11 px-3"
                  key={tool.to}
                  nativeButton={false}
                  render={<Link to={tool.to} />}
                >
                  {tool.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            aria-label="Your settings"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-duet-accent-soft font-semibold text-duet-accent transition-colors hover:bg-duet-tile focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40"
            title="Settings"
            to="/settings"
          >
            {user ? initialOf(user) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
