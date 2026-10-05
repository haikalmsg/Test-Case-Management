import Link from "next/link";
import { StatusBadge, ProgressBar } from "@/components/shared";
import { dateLabel } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/database.types";
import { runStats, type ResultStatus } from "./stats";

export function RunHistory({
  projectId,
  runs,
  allowRerun = true,
}: {
  projectId: string;
  runs: (Tables<"test_runs"> & {
    run_cases: { status: ResultStatus }[];
    test_plans?: { name: string; archived_at: string | null } | null;
  })[];
  allowRerun?: boolean;
}) {
  const base = `/projects/${projectId}`;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>RUN</th>
            <th>STATUS</th>
            <th>PROGRESS</th>
            <th>OUTCOMES</th>
            <th>PASS RATE</th>
            <th>CREATED</th>
            <th>
              <span className="sr-only">Rerun</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const stats = runStats(run.run_cases);
            return (
              <tr key={run.id}>
                <td>
                  <Link
                    className="font-medium hover:text-primary"
                    href={`${base}/runs/${run.id}`}
                  >
                    {run.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {run.environment || "No environment"} · {stats.total} cases
                  </p>
                  {run.test_plans ? (
                    <Link
                      className="text-xs text-primary"
                      href={`${base}/plans/${run.plan_id}`}
                    >
                      {run.test_plans.name}
                    </Link>
                  ) : !run.plan_id ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Legacy run
                    </p>
                  ) : null}
                  {run.source_run_id ? (
                    <Link
                      className="block text-xs text-primary"
                      href={`${base}/runs/${run.source_run_id}`}
                    >
                      Rerun of earlier execution
                    </Link>
                  ) : null}
                </td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td className="min-w-36">
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {stats.done}/{stats.total}
                    </span>
                    <span>{stats.progress}%</span>
                  </div>
                  <ProgressBar value={stats.progress} />
                </td>
                <td className="text-xs text-muted-foreground">
                  {stats.counts.passed} passed · {stats.counts.failed} failed
                  <br />
                  {stats.counts.blocked} blocked · {stats.counts.skipped}{" "}
                  skipped
                </td>
                <td>{stats.passRate === null ? "—" : `${stats.passRate}%`}</td>
                <td className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateLabel(run.created_at)}
                </td>
                <td>
                  {allowRerun &&
                  run.plan_id &&
                  !run.test_plans?.archived_at &&
                  run.status === "completed" ? (
                    <div className="flex flex-col gap-2 whitespace-nowrap text-xs text-primary">
                      <Link
                        href={`${base}/plans/${run.plan_id}/run?source=${run.id}`}
                      >
                        Rerun all
                      </Link>
                      {stats.counts.failed + stats.counts.blocked > 0 ? (
                        <Link
                          href={`${base}/plans/${run.plan_id}/run?source=${run.id}&mode=unsuccessful`}
                        >
                          Rerun failed/blocked
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
