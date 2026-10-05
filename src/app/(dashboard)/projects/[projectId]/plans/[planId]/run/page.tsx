import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getProject } from "@/features/projects/queries";
import { getPlan } from "@/features/plans/queries";
import { RunForm } from "@/features/runs/run-form";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { PageHeader } from "@/components/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function StartPlanRun({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; planId: string }>;
  searchParams: Promise<{ source?: string; mode?: string }>;
}) {
  const { projectId, planId } = await params;
  const [project, plan] = await Promise.all([
    getProject(projectId),
    getPlan(projectId, planId),
  ]);
  const base = `/projects/${projectId}/plans/${planId}`;
  if (project.archived_at || plan.archived_at) redirect(base);
  const f = await searchParams;
  if (f.mode && f.mode !== "all" && f.mode !== "unsuccessful") notFound();
  const mode = f.mode === "unsuccessful" ? "unsuccessful" : "all";
  if (f.source && !z.uuid().safeParse(f.source).success) notFound();
  if (mode === "unsuccessful" && !f.source) notFound();
  const { client } = await requireMember();
  const source = f.source
    ? await client
        .from("test_runs")
        .select("*,run_cases(case_id,case_number,snapshot,status)")
        .eq("id", f.source)
        .eq("project_id", projectId)
        .eq("plan_id", planId)
        .eq("status", "completed")
        .maybeSingle()
    : null;
  if (source) {
    assertOk(source.error);
    if (!source.data) notFound();
  }
  const sourceCases = source?.data?.run_cases ?? [];
  const unsuccessful = new Set(
    sourceCases
      .filter((c) => c.status === "failed" || c.status === "blocked")
      .map((c) => c.case_id),
  );
  const eligible = plan.cases.filter(
    (c) => !c.archived_at && (mode === "all" || unsuccessful.has(c.id)),
  );
  const excluded = new Map<
    string,
    { number: number; title: string; reason: string }
  >();
  for (const c of plan.cases) {
    if (c.archived_at && (mode === "all" || unsuccessful.has(c.id)))
      excluded.set(c.id, {
        number: c.number,
        title: c.title,
        reason: "Archived in case library",
      });
  }
  for (const c of sourceCases) {
    if (mode === "unsuccessful" && !unsuccessful.has(c.case_id)) continue;
    if (!plan.cases.some((current) => current.id === c.case_id))
      excluded.set(c.case_id, {
        number: c.case_number,
        title: (c.snapshot as { title: string }).title,
        reason: "Removed from this plan",
      });
  }
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / ${plan.name}`}
        title={f.source ? "Rerun test plan" : "Run test plan"}
        description={`${eligible.length} eligible cases · ${mode === "unsuccessful" ? "Failed and blocked cases from the selected execution" : "All current active plan cases"}`}
      />
      <p className="mb-5 text-sm text-muted-foreground">
        This execution uses the latest library definitions. Each case starts
        untested with empty notes; previous executions keep their original
        results and snapshots.
      </p>
      {source?.data ? (
        <p className="mb-5 text-sm">
          Source execution:{" "}
          <Link
            className="text-primary"
            href={`/projects/${projectId}/runs/${source.data.id}`}
          >
            {source.data.name}
          </Link>
        </p>
      ) : null}
      {excluded.size > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Excluded cases ({excluded.size})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[...excluded.values()].map((c) => (
                <li key={c.number}>
                  {project.code}-{c.number} · {c.title} — {c.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cases to execute ({eligible.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {eligible.length ? (
            <ul className="max-h-72 space-y-2 overflow-auto text-sm">
              {eligible.map((c) => (
                <li key={c.id}>
                  {project.code}-{c.number} · {c.title}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              No eligible cases remain to execute.{" "}
              <Link className="text-primary" href={base}>
                Return to plan
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
      {eligible.length ? (
        <RunForm
          projectId={projectId}
          planId={planId}
          name={`${plan.name}${f.source ? " · Rerun" : ""}`}
          environment={source?.data?.environment ?? ""}
          sourceRunId={f.source}
          mode={mode}
        />
      ) : null}
    </>
  );
}
