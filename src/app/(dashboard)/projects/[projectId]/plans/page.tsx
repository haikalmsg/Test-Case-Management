import Link from "next/link";
import { Plus } from "lucide-react";
import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Plans({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; archived?: string }>;
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
    .from("test_plans")
    .select("*,plan_cases(test_cases(archived_at))", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (f.archived === "1") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);
  const { data, error, count } = await query.range(
    (page - 1) * 20,
    page * 20 - 1,
  );
  assertOk(error);
  const base = `/projects/${projectId}/plans`;
  const pageHref = (n: number) =>
    `${base}?page=${n}${f.archived === "1" ? "&archived=1" : ""}`;
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Planning`}
        title="Test plans"
        description="Build reusable coverage from your case library, then run it as often as needed."
      >
        {!project.archived_at ? (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" />
              New plan
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      <div className="mb-4 flex gap-4 text-sm text-primary">
        <Link href={base}>Active plans</Link>
        <Link href={`${base}?archived=1`}>Archived plans</Link>
        <Link href={`/projects/${projectId}/cases`}>Case library</Link>
      </div>
      <Card>
        {data?.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PLAN</th>
                  <th>CASES</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((plan) => {
                  const active = plan.plan_cases.filter(
                    (c) => c.test_cases && !c.test_cases.archived_at,
                  ).length;
                  return (
                    <tr key={plan.id}>
                      <td>
                        <Link
                          className="font-medium hover:text-primary"
                          href={`${base}/${plan.id}`}
                        >
                          {plan.name}
                        </Link>
                        {plan.archived_at ? (
                          <Badge className="ml-2">Archived</Badge>
                        ) : null}
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {plan.description || "No description."}
                        </p>
                      </td>
                      <td className="text-sm">
                        {active} active / {plan.plan_cases.length} included
                      </td>
                      <td>
                        {!project.archived_at &&
                        !plan.archived_at &&
                        active > 0 ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${base}/${plan.id}/run`}>Run all</Link>
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              f.archived === "1" ? "No archived plans" : "No test plans yet"
            }
            description="Create a plan and import cases from the shared library."
            href={
              !project.archived_at && f.archived !== "1"
                ? `${base}/new`
                : undefined
            }
            label="Create a plan"
          />
        )}
        <div className="flex justify-between border-t p-4 text-xs text-muted-foreground">
          <span>
            {count ?? 0} plans · Page {page}
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link className="text-primary" href={pageHref(page - 1)}>
                ← Previous
              </Link>
            ) : null}
            {page * 20 < (count ?? 0) ? (
              <Link className="text-primary" href={pageHref(page + 1)}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
