import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { dateLabel } from "@/lib/utils";
import { runStats, resultStatuses } from "@/features/runs/stats";
import { recordResult, completeRun } from "@/features/runs/actions";
import { PageHeader, StatusBadge, ProgressBar } from "@/components/shared";
import { ActionForm, Field } from "@/components/forms";
import { Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
type Snapshot = {
  title: string;
  description: string;
  preconditions: string;
  priority: string;
  classification: string;
  suite_name: string | null;
  steps: { action: string; expected_result: string }[];
};
export default async function RunDetail({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const project = await getProject(projectId);
  const { client } = await requireMember();
  const [run, cases] = await Promise.all([
    client
      .from("test_runs")
      .select("*,test_plans(name,archived_at)")
      .eq("id", runId)
      .eq("project_id", projectId)
      .maybeSingle(),
    client
      .from("run_cases")
      .select("*,profiles(full_name,email)")
      .eq("run_id", runId)
      .eq("project_id", projectId)
      .order("case_number"),
  ]);
  assertOk(run.error);
  assertOk(cases.error);
  if (!run.data) notFound();
  const stats = runStats(cases.data ?? []);
  const editable = run.data.status === "active" && !project.archived_at;
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Execution`}
        title={run.data.name}
        description={`${run.data.environment || "No environment specified"} · Created ${dateLabel(run.data.created_at)}`}
      >
        <StatusBadge status={run.data.status} />
        {!run.data.plan_id ? <Badge>Legacy run</Badge> : null}
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        {run.data.plan_id ? (
          <Link
            className="text-primary"
            href={`/projects/${projectId}/plans/${run.data.plan_id}`}
          >
            Plan: {run.data.test_plans?.name}
          </Link>
        ) : (
          <Link
            className="text-primary"
            href={`/projects/${projectId}/runs?legacy=1`}
          >
            Legacy run history
          </Link>
        )}
        {run.data.source_run_id ? (
          <Link
            className="text-primary"
            href={`/projects/${projectId}/runs/${run.data.source_run_id}`}
          >
            View source execution
          </Link>
        ) : null}
        {run.data.plan_id &&
        run.data.status === "completed" &&
        !project.archived_at &&
        !run.data.test_plans?.archived_at ? (
          <>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/projects/${projectId}/plans/${run.data.plan_id}/run?source=${runId}`}
              >
                Rerun all
              </Link>
            </Button>
            {stats.counts.failed + stats.counts.blocked > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/projects/${projectId}/plans/${run.data.plan_id}/run?source=${runId}&mode=unsuccessful`}
                >
                  Rerun failed/blocked
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-56 flex-1">
              <div className="mb-3 flex justify-between text-sm">
                <span className="font-medium">
                  {stats.done} of {stats.total} cases executed
                </span>
                <span className="text-primary">{stats.progress}%</span>
              </div>
              <ProgressBar value={stats.progress} />
            </div>
            <div className="flex flex-wrap gap-3">
              {resultStatuses
                .filter((s) => s !== "untested")
                .map((status) => (
                  <div key={status} className="text-center">
                    <p className="mb-1 text-xl font-semibold">
                      {stats.counts[status]}
                    </p>
                    <StatusBadge status={status} />
                  </div>
                ))}
            </div>
            <div className="border-l pl-5">
              <p className="text-xl font-semibold">
                {stats.passRate === null ? "—" : `${stats.passRate}%`}
              </p>
              <p className="text-xs text-muted-foreground">Pass rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {run.data.status === "completed" ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          Completed{" "}
          {run.data.completed_at ? dateLabel(run.data.completed_at) : ""}. This
          run is read-only.
        </p>
      ) : null}
      <div className="space-y-4">
        {cases.data?.map((c) => {
          const snapshot = c.snapshot as Snapshot;
          return (
            <Card key={c.id}>
              <CardHeader>
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                    {project.code}-{c.case_number}
                  </p>
                  <CardTitle>{snapshot.title}</CardTitle>
                </div>
                <StatusBadge status={c.status} />
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    Case snapshot & steps
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex gap-2">
                      <Badge>{snapshot.priority}</Badge>
                      <Badge>{snapshot.classification}</Badge>
                      {snapshot.suite_name ? (
                        <Badge>{snapshot.suite_name}</Badge>
                      ) : null}
                    </div>
                    {snapshot.description ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {snapshot.description}
                      </p>
                    ) : null}
                    {snapshot.preconditions ? (
                      <div>
                        <p className="text-xs font-semibold">Preconditions</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {snapshot.preconditions}
                        </p>
                      </div>
                    ) : null}
                    {snapshot.steps.map((s, i) => (
                      <div
                        key={i}
                        className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-2"
                      >
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                            STEP {i + 1}
                          </p>
                          <p className="whitespace-pre-wrap">{s.action}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                            EXPECTED RESULT
                          </p>
                          <p className="whitespace-pre-wrap">
                            {s.expected_result}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
                {editable ? (
                  <ActionForm
                    key={`${c.id}-${c.status}-${c.tested_at}`}
                    action={recordResult}
                    submit="Save result"
                    className="mt-5 space-y-4"
                  >
                    <input name="id" type="hidden" value={c.id} />
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                      <Field label="Result" htmlFor={`status-${c.id}`}>
                        <Select
                          id={`status-${c.id}`}
                          name="status"
                          defaultValue={c.status}
                        >
                          {resultStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Notes" htmlFor={`notes-${c.id}`}>
                        <Textarea
                          id={`notes-${c.id}`}
                          name="notes"
                          defaultValue={c.notes}
                          className="min-h-20"
                          maxLength={10000}
                          placeholder="What happened? Add observations or a defect reference."
                        />
                      </Field>
                    </div>
                  </ActionForm>
                ) : c.notes ? (
                  <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
                    {c.notes}
                  </p>
                ) : null}
                {c.tested_at ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Recorded by{" "}
                    {c.profiles?.full_name ||
                      c.profiles?.email ||
                      "Team member"}{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }).format(new Date(c.tested_at))}{" "}
                    UTC
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {editable ? (
        <Card className="mt-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">
                Ready to close this run?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.counts.untested
                  ? `${stats.counts.untested} cases still need a result. Use skipped for cases you won’t execute.`
                  : "Every case has a result. Completing the run makes it read-only."}
              </p>
            </div>
            <ActionForm
              action={completeRun}
              submit="Complete run"
              confirm="Complete this run? Its results will become read-only."
            >
              <input type="hidden" name="id" value={runId} />
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
