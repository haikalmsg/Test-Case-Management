import Link from "next/link";
import {
  Plus,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getProject } from "@/features/projects/queries";
import { assertOk } from "@/lib/actions";
import { PageHeader, StatusBadge, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
type Filters = {
  q?: string;
  suite?: string;
  priority?: string;
  classification?: string;
  page?: string;
};
export default async function Cases({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Filters>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  const { client } = await requireMember();
  const f = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(f.page ?? "1", 10) || 1),
  );
  const pageSize = 20;
  const base = `/projects/${projectId}`;
  let query = client
    .from("test_cases")
    .select("*,suites(name)", { count: "exact" })
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("number");
  if (f.q)
    query = query.ilike(
      "title",
      `%${f.q.slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (f.suite && z.uuid().safeParse(f.suite).success)
    query = query.eq("suite_id", f.suite);
  const priority = z
    .enum(["low", "medium", "high", "critical"])
    .safeParse(f.priority);
  if (priority.success) query = query.eq("priority", priority.data);
  const classification = z
    .enum(["manual", "automated"])
    .safeParse(f.classification);
  if (classification.success)
    query = query.eq("classification", classification.data);
  const [cases, suites] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    client
      .from("suites")
      .select("id,name")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("name"),
  ]);
  assertOk(cases.error);
  assertOk(suites.error);
  const pages = Math.max(1, Math.ceil((cases.count ?? 0) / pageSize));
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(f))
      if (value && key !== "page") p.set(key, value);
    p.set("page", String(n));
    return `${base}/cases?${p}`;
  };
  if (page > pages) redirect(pageHref(pages));
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Repository`}
        title="Test repository"
        description={`A reliable source of truth for ${project.name}.`}
      >
        {!project.archived_at ? (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`${base}/runs/new`}>
                <Play className="size-4" />
                Start a run
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/cases/new`}>
                <Plus className="size-4" />
                New case
              </Link>
            </Button>
          </div>
        ) : null}
      </PageHeader>
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={f.q}
              aria-label="Search test cases"
              placeholder="Search test cases…"
              className="pl-9"
              maxLength={200}
            />
          </div>
          <Select
            name="suite"
            aria-label="Filter by suite"
            defaultValue={f.suite ?? ""}
            className="w-auto max-w-56"
          >
            <option value="">All suites</option>
            {suites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            name="priority"
            aria-label="Filter by priority"
            defaultValue={f.priority ?? ""}
            className="w-auto"
          >
            <option value="">All priorities</option>
            {["low", "medium", "high", "critical"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            name="classification"
            aria-label="Filter by classification"
            defaultValue={f.classification ?? ""}
            className="w-auto"
          >
            <option value="">All types</option>
            <option value="manual">Manual</option>
            <option value="automated">Automated</option>
          </Select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {f.q || f.suite || f.priority || f.classification ? (
            <Button asChild variant="ghost">
              <Link href={`${base}/cases`}>Clear</Link>
            </Button>
          ) : null}
        </form>
        {cases.data?.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>TITLE</th>
                  <th>SUITE</th>
                  <th>PRIORITY</th>
                  <th>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {cases.data.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {project.code}-{c.number}
                    </td>
                    <td>
                      <Link
                        href={`${base}/cases/${c.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {c.suites?.name ?? "—"}
                    </td>
                    <td>
                      <StatusBadge status={c.priority} />
                    </td>
                    <td>
                      <Badge>{c.classification}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No test cases found"
            description="Create your first case or adjust your filters to find what you need."
            href={!project.archived_at ? `${base}/cases/new` : undefined}
            label="Create a test case"
          />
        )}
        <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground">
          <span>
            {cases.count ?? 0} cases · Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft className="size-3" />
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(page + 1)}>
                  Next
                  <ChevronRight className="size-3" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
