import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cue's dot sits inside the c. A live face can replace the still in the chat header. */
export function CueWordmark({
  face,
  nameClassName,
}: {
  face?: ReactNode;
  nameClassName?: string;
}) {
  return (
    <span
      aria-label="Cue"
      className="inline-flex items-center gap-0.5 text-duet-accent"
      role="img"
    >
      <span aria-hidden className="relative grid size-10 place-items-center">
        <svg
          aria-hidden
          className="absolute inset-0 size-full"
          viewBox="0 0 40 40"
        >
          <path
            d="M33 8a17 17 0 1 0 0 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
        {face ?? <CueDot className="size-[22px]" />}
      </span>
      <span
        aria-hidden
        className={cn(
          "text-[2.5rem] font-bold leading-none tracking-[-0.06em]",
          nameClassName,
        )}
      >
        ue
      </span>
    </span>
  );
}

/** The dot on a blue background can use the inverse white face. */
export function CueDot({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <svg
      aria-hidden
      className={cn("size-8 shrink-0", className)}
      viewBox="0 0 48 48"
    >
      <circle cx="24" cy="24" r="23" fill={inverse ? "#ffffff" : "#2f5dff"} />
      <g fill={inverse ? "#2f5dff" : "#ffffff"}>
        <rect x="15" y="16" width="5.5" height="16" rx="2.75" />
        <rect x="27.5" y="16" width="5.5" height="16" rx="2.75" />
      </g>
    </svg>
  );
}
