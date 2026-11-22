import type {
  HubAssignment,
  HubClass,
  RulesView,
  SchoolHub,
  SchoolSnapshot,
} from "@openbot/shared/study";

/**
 * The hub: the student's stored classes and work (school.ts keeps them in openduet_study_records)
 * joined with the help level in force for each (rules.ts). One shape for the Classes screen and for
 * list_assignments, so the Bot and the student read the same due dates and the same levels.
 */
export function schoolHub(
  snapshot: SchoolSnapshot | null,
  rules: RulesView,
): SchoolHub {
  if (!snapshot)
    return {
      timeZone: rules.timeZone,
      syncedAt: null,
      classes: [],
      couldNotRead: rules.couldNotRead,
    };
  const classById = new Map(
    snapshot.classes.map((schoolClass) => [schoolClass.id, schoolClass]),
  );
  const workById = new Map(
    snapshot.assignments.map((assignment) => [assignment.id, assignment]),
  );
  const classes: HubClass[] = [];
  // The rules view lists each class by name and its work soonest due first; that order is kept.
  for (const ruled of rules.classes) {
    const schoolClass = classById.get(ruled.classId);
    if (!schoolClass) continue;
    const assignments: HubAssignment[] = [];
    for (const row of ruled.assignments) {
      const work = workById.get(row.assignmentId);
      if (!work) continue;
      assignments.push({
        id: work.id,
        title: work.title,
        kind: work.kind,
        status: work.status,
        due: work.due,
        points: work.points,
        grade: work.grade,
        minutes: work.minutes,
        link: work.link,
        level: row.level,
        source: row.source,
      });
    }
    classes.push({
      id: schoolClass.id,
      name: schoolClass.name,
      teacher: schoolClass.teacher,
      period: schoolClass.period,
      color: schoolClass.color,
      level: ruled.level,
      source: ruled.source,
      assignments,
    });
  }
  return {
    timeZone: snapshot.timeZone,
    syncedAt: snapshot.syncedAt,
    classes,
    couldNotRead: rules.couldNotRead,
  };
}
