import Link from "next/link";
import {
  FolderKanban,
  BookOpen,
  Play,
  TrendingUp,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { dateLabel } from "@/lib/utils";
import {
  PageHeader,
  Metric,
  EmptyState,
  StatusBadge,
  ProgressBar,
} from "@/components/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { runStats, resultStatuses } from "@/features/runs/stats";
export default async function Dashboard() {
  const { client, member } = await requireMember();
  const [summary, runs, projects] = await Promise.all([
    client.rpc("dashboard_summary"),
    client
      .from("test_runs")
      .select("*, projects(name,code), run_cases(status)")
      .order("created_at", { ascending: false })
      .limit(6),
    client
      .from("projects")
      .select("id,name,code")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  [summary, runs, projects].forEach((r) => assertOk(r.error));
  const stats = summary.data as {
    projects: number;
    cases: number;
    active_runs: number;
    results: Record<string, number>;
  };
  const passed = stats.results.passed ?? 0;
  const failed = stats.results.failed ?? 0;
  const passRate =
    passed + failed ? Math.round((passed / (passed + failed)) * 100) : null;
  const total = Object.values(stats.results).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader
        eyebrow="Quality at a glance"
        title="Workspace overview"
        description="A shared view of what’s ready, what’s running, and what needs attention."
      >
        {member.role === "admin" ? (
          <Button asChild>
            <Link href="/projects#new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/projects">
              View projects
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Active projects"
          value={stats.projects}
          detail="Projects your team is working on"
          icon={FolderKanban}
        />
        <Metric
          title="Test cases"
          value={stats.cases}
          detail="Active cases across your projects"
          icon={BookOpen}
        />
        <Metric
          title="Runs in progress"
          value={stats.active_runs}
          detail="Active runs in active projects"
          icon={Play}
        />
        <Metric
          title="Pass rate"
          value={passRate === null ? "—" : `${passRate}%`}
          detail="Passed / (passed + failed), all runs"
          icon={TrendingUp}
        />
      </div>
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent test runs</CardTitle>
            <span className="text-xs text-muted-foreground">
              Latest activity
            </span>
          </CardHeader>
          {runs.data?.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>RUN</th>
                    <th>STATUS</th>
                    <th>PROGRESS</th>
                    <th>CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((run) => {
                    const s = runStats(run.run_cases);
                    return (
                      <tr key={run.id}>
                        <td>
                          <Link
                            className="font-medium hover:text-primary"
                            href={`/projects/${run.project_id}/runs/${run.id}`}
                          >
                            {run.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {run.projects?.name} · {s.total} cases
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
              title="Ready for your first test run"
              description="Add cases to a project, then select them to start a run."
              href="/projects"
              label="Explore projects"
            />
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Result breakdown</CardTitle>
              <span className="text-xs text-muted-foreground">All runs</span>
            </CardHeader>
            <CardContent>
              {total ? (
                <>
                  <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-muted">
                    {resultStatuses.map((status) => (
                      <div
                        key={status}
                        style={{
                          width: `${((stats.results[status] ?? 0) / total) * 100}%`,
                        }}
                        className={
                          {
                            passed: "bg-emerald-500",
                            failed: "bg-rose-500",
                            blocked: "bg-amber-400",
                            skipped: "bg-violet-400",
                            untested: "bg-slate-300",
                          }[status]
                        }
                      />
                    ))}
                  </div>
                  <div className="space-y-3">
                    {resultStatuses.map((status) => (
                      <div
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <StatusBadge status={status} />
                        <span className="text-sm font-medium">
                          {stats.results[status] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  Results appear when you create a run.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your projects</CardTitle>
              <Link href="/projects" className="text-xs text-primary">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.data?.length ? (
                projects.data.map((p) => (
                  <Link
                    href={`/projects/${p.id}/cases`}
                    key={p.id}
                    className="flex items-center gap-3 text-sm hover:text-primary"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-primary">
                      {p.code.slice(0, 2)}
                    </div>
                    <span className="truncate">{p.name}</span>
                    <ArrowUpRight className="ml-auto size-3 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No active projects yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-7 flex items-center gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
          <CheckIcon />
        </div>
        <div>
          <h2 className="text-sm font-semibold">
            Make the next release a confident one.
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Organize your cases, record every outcome, and keep your team on the
            same page.
          </p>
        </div>
      </div>
    </>
  );
}
function CheckIcon() {
  return <BookOpen className="size-5" />;
}
