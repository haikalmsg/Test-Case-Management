import Link from "next/link";
import { getProject } from "@/features/projects/queries";
import { getPlan } from "@/features/plans/queries";
import { archivePlan } from "@/features/plans/actions";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { PageHeader, StatusBadge, EmptyState } from "@/components/shared";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/forms";
import { RunHistory } from "@/features/runs/run-history";

export default async function PlanDetail({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; planId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { projectId, planId } = await params;
  const [project, plan] = await Promise.all([
    getProject(projectId),
    getPlan(projectId, planId),
  ]);
  const { client } = await requireMember();
  const f = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(f.page ?? "1", 10) || 1),
  );
  const runs = await client
    .from("test_runs")
    .select("*,run_cases(status)", { count: "exact" })
    .eq("project_id", projectId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  assertOk(runs.error);
  const editable = !project.archived_at && !plan.archived_at;
  const activeCount = plan.cases.filter((c) => !c.archived_at).length;
  const base = `/projects/${projectId}/plans/${planId}`;
  const groups = new Map<string, { name: string; cases: typeof plan.cases }>();
  for (const c of plan.cases) {
    const key = c.suites?.id ?? "ungrouped";
    const group = groups.get(key) ?? {
      name: c.suites?.name ?? "Ungrouped",
      cases: [],
    };
    group.cases.push(c);
    groups.set(key, group);
  }
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Test plan`}
        title={plan.name}
        description={
          plan.description || "Reusable coverage from your case library."
        }
      >
        {plan.archived_at ? <Badge>Archived</Badge> : null}
        {editable ? (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`${base}/edit`}>Edit plan</Link>
            </Button>
            {activeCount > 0 ? (
              <Button asChild>
                <Link href={`${base}/run`}>Run all</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </PageHeader>
      {plan.archived_at ? (
        <p
          role="status"
          className="mb-6 rounded-lg border bg-slate-50 p-4 text-sm"
        >
          This plan is archived. Its history is preserved and existing active
          runs can still be finished.
        </p>
      ) : null}
      <h2 className="mb-3 text-lg font-semibold">
        Included test cases ({activeCount} active / {plan.cases.length}{" "}
        included)
      </h2>
      {!plan.cases.length ? (
        <Card>
          <EmptyState
            title="This plan is a draft"
            description="Import cases from the library before starting a run."
            href={editable ? `${base}/edit` : undefined}
            label="Import cases"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...groups]
            .sort(([, a], [, b]) => a.name.localeCompare(b.name))
            .map(([key, { name, cases }]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {cases.length} cases
                  </span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>CASE</th>
                        <th>PRIORITY</th>
                        <th>TYPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((c) => (
                        <tr key={c.id}>
                          <td className="whitespace-nowrap text-xs text-muted-foreground">
                            {project.code}-{c.number}
                          </td>
                          <td>
                            <Link
                              className="font-medium hover:text-primary"
                              href={`/projects/${projectId}/cases/${c.id}`}
                            >
                              {c.title}
                            </Link>
                            {c.archived_at ? (
                              <Badge className="ml-2">
                                Archived · excluded from new runs
                              </Badge>
                            ) : null}
                          </td>
                          <td>
                            <StatusBadge status={c.priority} />
                          </td>
                          <td>{c.classification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Execution history</h2>
      <Card>
        {runs.data?.length ? (
          <RunHistory
            projectId={projectId}
            runs={runs.data}
            allowRerun={editable}
          />
        ) : (
          <EmptyState
            title="No executions yet"
            description="Run this plan to begin recording outcomes."
            href={editable && activeCount > 0 ? `${base}/run` : undefined}
            label="Run all"
          />
        )}
        <div className="flex justify-between border-t p-4 text-xs text-muted-foreground">
          <span>
            {runs.count ?? 0} runs · Page {page}
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link className="text-primary" href={`?page=${page - 1}`}>
                ← Previous
              </Link>
            ) : null}
            {page * 20 < (runs.count ?? 0) ? (
              <Link className="text-primary" href={`?page=${page + 1}`}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
      {editable ? (
        <details className="mt-8 rounded-xl border bg-white p-5">
          <summary className="cursor-pointer text-sm font-medium">
            Archive plan
          </summary>
          <ActionForm
            action={archivePlan}
            submit="Archive plan"
            variant="destructive"
            className="mt-4 space-y-4"
            confirm="Archive this plan? New runs will be disabled. Existing runs and case library entries are preserved."
          >
            <input type="hidden" name="id" value={planId} />
            <p className="text-sm text-muted-foreground">
              Preserve this plan and its history while removing it from active
              planning.
            </p>
          </ActionForm>
        </details>
      ) : null}
    </>
  );
}
