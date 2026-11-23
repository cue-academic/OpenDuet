import { HELP_LEVEL_LABEL, type HelpLevel } from "@openbot/shared/study";
import { cn } from "@/lib/utils";
import { DuetIcon, type DuetIconName } from "../icons";

/*
 * Colour only as status (kit.tsx): "On your own" and "Test" stop the study tools, so they take the
 * problem tone; "Guided help" changes how the Bot answers, so it takes the needs tone; "Study" asks
 * nothing of the student and stays grey. The glyph says the same thing without the colours.
 */
const TONE: Record<HelpLevel, string> = {
  test: "text-duet-status-problem",
  none: "text-duet-status-problem",
  hints: "text-duet-status-needs",
  full: "text-duet-ink-2",
};

const ICON: Record<HelpLevel, DuetIconName | null> = {
  test: "x",
  none: "lock",
  hints: "bulb",
  full: "deck",
};

/** A teacher's AI-help level in the words the Classroom notice uses: Study, Guided help, On your own, Test. */
export function HelpLevelPill({ level }: { level: HelpLevel }) {
  const icon = ICON[level];
  return (
    <span
      className={cn(
        "type-caption inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium",
        TONE[level],
      )}
      data-help-level={level}
    >
      {icon ? <DuetIcon name={icon} size={14} stroke={2.4} /> : null}
      {HELP_LEVEL_LABEL[level]}
    </span>
  );
}
