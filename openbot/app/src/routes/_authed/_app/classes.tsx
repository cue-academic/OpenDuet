import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClassesView } from "@/components/duet/study";
import { PageShell } from "@/components/layout/page-shell";
import { hubQueryOptions, syncSchoolMutationOptions } from "@/lib/study/rules";

export const Route = createFileRoute("/_authed/_app/classes")({
  component: ClassesPage,
});

/**
 * Classes: every class the student takes with its assignments, due dates and AI-help level, as
 * stored from their Classroom notices. The page is the reads; ClassesView draws it.
 */
function ClassesPage() {
  const queryClient = useQueryClient();
  const hub = useQuery(hubQueryOptions());
  const sync = useMutation(syncSchoolMutationOptions(queryClient));

  return (
    <PageShell
      description="Your classes, what's due and how much AI help each one allows."
      title="Classes"
    >
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
    </PageShell>
  );
}
