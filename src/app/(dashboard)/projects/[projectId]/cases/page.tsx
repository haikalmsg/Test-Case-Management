import Link from "next/link";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Folder,
  FileText,
  Library,
  ArrowUp,
} from "lucide-react";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getProject } from "@/features/projects/queries";
import { getCaseGroups } from "@/features/repository/queries";
import {
  groupAncestors,
  groupDescendants,
  groupOptions,
} from "@/features/repository/groups";
import { LibraryTree } from "@/features/repository/library-tree";
import { GroupControls } from "@/features/repository/group-controls";
import { assertOk } from "@/lib/actions";
import { PageHeader, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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
  const [project, groups, f] = await Promise.all([
    getProject(projectId),
    getCaseGroups(projectId),
    searchParams,
  ]);
  const { client } = await requireMember();
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(f.page ?? "1", 10) || 1),
  );
  const pageSize = 20;
  const base = `/projects/${projectId}`;
  const selected = f.suite ?? "";
  const current = groups.find((group) => group.id === selected);
  if (
    selected &&
    selected !== "all" &&
    selected !== "ungrouped" &&
    (!z.uuid().safeParse(selected).success || !current)
  )
    notFound();
  const chain = current ? groupAncestors(groups, current.id) : [];
  const paths = new Map(
    groupOptions(groups).map((group) => [group.id, group.path]),
  );
  const priority = z
    .enum(["low", "medium", "high", "critical"])
    .safeParse(f.priority);
  const classification = z
    .enum(["manual", "automated"])
    .safeParse(f.classification);
  const searching = !!f.q?.trim() || priority.success || classification.success;
  const folders =
    selected === "all" || selected === "ungrouped" || searching
      ? []
      : groups
          .filter(
            (group) =>
              group.parent_id === (current?.id ?? null) && !group.archived_at,
          )
          .sort((a, b) => a.name.localeCompare(b.name));
  let query = client
    .from("test_cases")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("number");
  if (current)
    query = searching
      ? query.in("suite_id", groupDescendants(groups, current.id))
      : query.eq("suite_id", current.id);
  else if (selected === "ungrouped" || (!selected && !searching))
    query = query.is("suite_id", null);
  if (f.q)
    query = query.ilike(
      "title",
      `%${f.q.slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (priority.success) query = query.eq("priority", priority.data);
  if (classification.success)
    query = query.eq("classification", classification.data);
  const cases = await query.range((page - 1) * pageSize, page * pageSize - 1);
  assertOk(cases.error);
  const pages = Math.max(1, Math.ceil((cases.count ?? 0) / pageSize));
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(f))
      if (value && key !== "page") p.set(key, value);
    p.set("page", String(n));
    return `${base}/cases?${p}`;
  };
  if (page > pages) redirect(pageHref(pages));
  const folderHref = (id?: string | null) =>
    id ? `${base}/cases?suite=${id}` : `${base}/cases`;
  const location =
    current?.name ??
    (selected === "all"
      ? "All cases"
      : selected === "ungrouped"
        ? "Ungrouped"
        : "Library");
  const newCaseHref = `${base}/cases/new${current && !current.archived_at ? `?group=${current.id}` : ""}`;
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Repository`}
        title="Case library"
        description="Browse test cases in folders, then reuse them in your test plans."
      >
        {!project.archived_at ? (
          <Button asChild variant="outline">
            <Link
              href={`${base}/plans/new${current ? `?group=${current.id}` : ""}`}
            >
              Create a plan
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      <Card className="overflow-hidden">
        <div className="grid min-h-[560px] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="max-h-[680px] overflow-auto border-b bg-slate-50/70 lg:border-b-0 lg:border-r">
            <LibraryTree
              key={chain.map((group) => group.id).join("/") || selected}
              projectId={projectId}
              groups={groups}
              selected={selected}
            />
          </aside>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <Button asChild size="icon" variant="ghost">
                <Link
                  aria-label="Go to parent folder"
                  href={folderHref(current?.parent_id)}
                >
                  <ArrowUp className="size-4" />
                </Link>
              </Button>
              <nav
                aria-label="Folder breadcrumbs"
                className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
              >
                <Link
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                  href={folderHref()}
                >
                  <Library className="size-4" />
                  Library
                </Link>
                {chain.map((group, i) => (
                  <span key={group.id} className="flex items-center gap-2">
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <Link
                      href={folderHref(group.id)}
                      className={
                        i === chain.length - 1
                          ? "font-medium"
                          : "text-muted-foreground hover:text-primary"
                      }
                      aria-current={i === chain.length - 1 ? "page" : undefined}
                    >
                      {group.name}
                    </Link>
                  </span>
                ))}
                {selected === "all" || selected === "ungrouped" ? (
                  <>
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span>{location}</span>
                  </>
                ) : null}
              </nav>
            </div>
            {!project.archived_at ? (
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <GroupControls
                  projectId={projectId}
                  groups={groups}
                  current={current}
                />
                <Button asChild size="sm">
                  <Link href={newCaseHref}>
                    <Plus className="size-4" />
                    New case
                  </Link>
                </Button>
              </div>
            ) : null}
            {current?.archived_at ? (
              <p
                role="status"
                className="border-b bg-amber-50 p-3 text-xs text-amber-800"
              >
                This folder is archived. Its cases remain available in the
                library and plans.
              </p>
            ) : current?.description ? (
              <p className="border-b px-4 py-3 text-xs text-muted-foreground">
                {current.description}
              </p>
            ) : null}
            <form className="flex flex-wrap items-center gap-3 border-b p-4">
              {selected ? (
                <input type="hidden" name="suite" value={selected} />
              ) : null}
              <div className="relative min-w-44 flex-1">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={f.q}
                  aria-label="Search test cases"
                  placeholder={
                    current
                      ? `Search ${current.name} and subfolders…`
                      : "Search library…"
                  }
                  className="pl-9"
                  maxLength={200}
                />
              </div>
              <Select
                name="priority"
                aria-label="Filter by priority"
                defaultValue={f.priority ?? ""}
                className="w-auto"
              >
                <option value="">All priorities</option>
                {["low", "medium", "high", "critical"].map((p) => (
                  <option key={p} value={p}>
                    {p}
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
              <Button type="submit" variant="outline" size="sm">
                Filter
              </Button>
              {searching ? (
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={
                      selected
                        ? `${base}/cases?suite=${selected}`
                        : folderHref()
                    }
                  >
                    Clear
                  </Link>
                </Button>
              ) : null}
            </form>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>ID</th>
                    <th>TYPE</th>
                    <th>PRIORITY</th>
                    {searching || selected === "all" ? <th>FOLDER</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {page === 1
                    ? folders.map((folder) => (
                        <tr key={folder.id}>
                          <td>
                            <Link
                              className="flex items-center gap-3 font-medium hover:text-primary"
                              href={folderHref(folder.id)}
                            >
                              <Folder className="size-5 shrink-0 fill-amber-100 text-amber-500" />
                              {folder.name}
                            </Link>
                          </td>
                          <td className="text-muted-foreground">—</td>
                          <td className="text-xs text-muted-foreground">
                            Folder
                          </td>
                          <td className="text-muted-foreground">—</td>
                        </tr>
                      ))
                    : null}
                  {cases.data?.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="flex items-center gap-3 font-medium hover:text-primary"
                          href={`${base}/cases/${c.id}`}
                        >
                          <FileText className="size-4 shrink-0 text-slate-400" />
                          {c.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">
                        {project.code}-{c.number}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {c.classification}
                      </td>
                      <td>
                        <StatusBadge status={c.priority} />
                      </td>
                      {searching || selected === "all" ? (
                        <td className="text-xs text-muted-foreground">
                          {c.suite_id ? paths.get(c.suite_id) : "Library"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!cases.data?.length && !folders.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <Folder className="size-10 text-slate-300" />
                <p className="text-sm font-medium">
                  {searching ? "No matching cases" : "This folder is empty"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searching
                    ? "Adjust your search or filters."
                    : "Create a subfolder or add a test case here."}
                </p>
                {!project.archived_at && !searching ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={newCaseHref}>Create a test case</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                {folders.length} folders · {cases.count ?? 0} cases · Page{" "}
                {page} of {pages}
                {searching && current ? " · Includes subfolders" : ""}
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
          </div>
        </div>
      </Card>
    </>
  );
}
