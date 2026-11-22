import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClassesView } from "@/components/duet/study";
import { ScreenScroll } from "@/components/shell/screen";
import { hubQueryOptions, syncSchoolMutationOptions } from "@/lib/study/rules";

export const Route = createFileRoute("/_authed/_app/classes")({
  component: ClassesPage,
});

/**
 * Classes: every class the student takes with its assignments, due dates and AI-help level, as
 * stored from their Classroom notices. It opens beside the chat like Coach and the calendar, under
 * the same bar. The page is the reads; ClassesView draws it.
 */
function ClassesPage() {
  const queryClient = useQueryClient();
  const hub = useQuery(hubQueryOptions());
  const sync = useMutation(syncSchoolMutationOptions(queryClient));

  return (
    <ScreenScroll>
      {/* The bar over the screen names it; the heading stays for screen readers. */}
      <h1 className="sr-only">Classes</h1>
      <p className="cue-label mb-3 px-1 text-duet-ink-2">
        What's due, and how much AI help each class allows
      </p>
      <ClassesView
        connections={({ className, children }) => (
          <Link className={className} to="/connections">
            {children}
          </Link>
        )}
        hub={hub.data ?? null}
        loadError={hub.error?.message ?? null}
        onRefresh={() => sync.mutate()}
        onReload={() => void hub.refetch()}
        refreshError={sync.error?.message ?? null}
        refreshing={sync.isPending}
        rules={({ className, children }) => (
          <Link className={className} to="/settings/teacher-rules">
            {children}
          </Link>
        )}
      />
    </ScreenScroll>
  );
}
