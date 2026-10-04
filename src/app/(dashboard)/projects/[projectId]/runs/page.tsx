import Link from "next/link";
import { Plus, Play } from "lucide-react";
import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { dateLabel } from "@/lib/utils";
import { runStats } from "@/features/runs/stats";
import {
  PageHeader,
  StatusBadge,
  ProgressBar,
  EmptyState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export default async function Runs({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  const { client } = await requireMember();
  const { page: raw } = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(raw ?? "1", 10) || 1),
  );
  const { data, error, count } = await client
    .from("test_runs")
    .select("*,run_cases(status)", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  assertOk(error);
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Execution`}
        title="Test runs"
        description="Every execution, every outcome, in one place."
      >
        {!project.archived_at ? (
          <Button asChild>
            <Link href={`/projects/${projectId}/runs/new`}>
              <Plus className="size-4" />
              Start a run
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      <Card>
        {data?.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>RUN</th>
                  <th>STATUS</th>
                  <th>PROGRESS</th>
                  <th>PASS RATE</th>
                  <th>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {data.map((run) => {
                  const s = runStats(run.run_cases);
                  return (
                    <tr key={run.id}>
                      <td>
                        <Link
                          className="font-medium hover:text-primary"
                          href={`/projects/${projectId}/runs/${run.id}`}
                        >
                          {run.name}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {run.environment || "No environment"} · {s.total}{" "}
                          cases
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="min-w-36">
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                          <span>
                            {s.done}/{s.total}
                          </span>
                          <span>{s.progress}%</span>
                        </div>
                        <ProgressBar value={s.progress} />
                      </td>
                      <td className="text-sm font-medium">
                        {s.passRate === null ? "—" : `${s.passRate}%`}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">
                        {dateLabel(run.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Play}
            title="No runs yet"
            description="Start a run to execute selected cases and record your results."
            href={
              !project.archived_at
                ? `/projects/${projectId}/runs/new`
                : undefined
            }
            label="Start a test run"
          />
        )}
        <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground">
          <span>
            {count ?? 0} runs · Page {page}
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={`?page=${page - 1}`} className="text-primary">
                ← Previous
              </Link>
            ) : null}
            {page * 20 < (count ?? 0) ? (
              <Link href={`?page=${page + 1}`} className="text-primary">
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
