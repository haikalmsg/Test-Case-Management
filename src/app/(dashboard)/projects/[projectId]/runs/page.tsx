import Link from "next/link";
import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RunHistory } from "@/features/runs/run-history";

export default async function Runs({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; legacy?: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  const { client } = await requireMember();
  const f = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(f.page ?? "1", 10) || 1),
  );
  let query = client
    .from("test_runs")
    .select("*,run_cases(status),test_plans(name,archived_at)", {
      count: "exact",
    })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (f.legacy === "1") query = query.is("plan_id", null);
  const { data, error, count } = await query.range(
    (page - 1) * 20,
    page * 20 - 1,
  );
  assertOk(error);
  const base = `/projects/${projectId}`;
  const pageHref = (n: number) =>
    `?page=${n}${f.legacy === "1" ? "&legacy=1" : ""}`;
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Execution`}
        title={f.legacy === "1" ? "Legacy runs" : "Run history"}
        description="Every plan execution and earlier standalone run, with its original outcomes."
      >
        {!project.archived_at ? (
          <Button asChild>
            <Link href={`${base}/plans`}>Choose a plan to run</Link>
          </Button>
        ) : null}
      </PageHeader>
      <div className="mb-4 flex gap-4 text-sm text-primary">
        <Link href={`${base}/runs`}>All runs</Link>
        <Link href={`${base}/runs?legacy=1`}>Legacy runs</Link>
      </div>
      <Card>
        {data?.length ? (
          <RunHistory
            projectId={projectId}
            runs={data}
            allowRerun={!project.archived_at}
          />
        ) : (
          <EmptyState
            title="No runs yet"
            description="Choose a test plan and start an execution to record outcomes."
            href={!project.archived_at ? `${base}/plans` : undefined}
            label="View test plans"
          />
        )}
        <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground">
          <span>
            {count ?? 0} runs · Page {page}
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="text-primary">
                ← Previous
              </Link>
            ) : null}
            {page * 20 < (count ?? 0) ? (
              <Link href={pageHref(page + 1)} className="text-primary">
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
