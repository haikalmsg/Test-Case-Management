"use client";
import { useRef, useState, useTransition } from "react";
import { ActionForm, Field } from "@/components/forms";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared";
import { savePlan, findLibraryCases, importCaseGroup } from "./actions";
import type { LibraryCase, LibraryFilters } from "./queries";

export function PlanForm({
  projectId,
  code,
  cases,
  total,
  groups,
  plan,
  defaultGroup = "",
}: {
  projectId: string;
  code: string;
  cases: LibraryCase[];
  total: number;
  groups: {
    id: string;
    name: string;
    path: string;
    archived_at: string | null;
  }[];
  defaultGroup?: string;
  plan?: {
    id: string;
    name: string;
    description: string;
    cases: LibraryCase[];
  };
}) {
  const [selected, setSelected] = useState(
    new Map((plan?.cases ?? []).map((c) => [c.id, c])),
  );
  const [filters, setFilters] = useState<LibraryFilters>({
    projectId,
    query: "",
    group: defaultGroup,
    priority: "",
    classification: "",
  });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState(cases);
  const [count, setCount] = useState(total);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  function load(nextPage: number, nextFilters = applied) {
    const requestId = ++request.current;
    startTransition(async () => {
      const result = await findLibraryCases({ ...nextFilters, page: nextPage });
      if (requestId !== request.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
      setCount(result.count);
      setPage(nextPage);
      setApplied(nextFilters);
      setError(undefined);
    });
  }
  function addCases(items: LibraryCase[]) {
    const next = new Map(selected);
    for (const c of items) next.set(c.id, c);
    if (next.size > 1000) {
      setError(
        "A plan can include up to 1,000 cases. Remove some cases first.",
      );
      return;
    }
    setSelected(next);
    setError(undefined);
  }
  function importGroup() {
    startTransition(async () => {
      const result = await importCaseGroup({ projectId, group: filters.group });
      if (result.error) {
        setError(result.error);
        return;
      }
      addCases(result.rows);
    });
  }
  return (
    <ActionForm
      action={savePlan}
      submit={plan ? "Save plan" : "Create plan"}
      submitDisabled={pending}
      className="space-y-6"
    >
      <input type="hidden" name="project_id" value={projectId} />
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      {[...selected.keys()].map((id) => (
        <input key={id} type="hidden" name="case_ids" value={id} />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Plan name" htmlFor="name">
            <Input
              id="name"
              name="name"
              defaultValue={plan?.name}
              maxLength={160}
              required
              placeholder="e.g. Release smoke tests"
            />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              defaultValue={plan?.description}
              maxLength={10000}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Import from case library</CardTitle>
          <span className="text-xs text-muted-foreground">
            {selected.size} / 1,000 included
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input
              aria-label="Search library cases"
              placeholder="Search by title…"
              maxLength={200}
              className="min-w-56 flex-1"
              value={filters.query}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load(1, filters);
                }
              }}
            />
            <Select
              aria-label="Filter by case group"
              value={filters.group}
              className="w-auto max-w-56"
              onChange={(e) =>
                setFilters({ ...filters, group: e.target.value })
              }
            >
              <option value="">All groups</option>
              <option value="ungrouped">Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.path}
                  {g.archived_at ? " (archived group)" : ""}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter library by priority"
              value={filters.priority}
              className="w-auto"
              onChange={(e) =>
                setFilters({
                  ...filters,
                  priority: e.target.value as LibraryFilters["priority"],
                })
              }
            >
              <option value="">All priorities</option>
              {["low", "medium", "high", "critical"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Select
              aria-label="Filter library by type"
              value={filters.classification}
              className="w-auto"
              onChange={(e) =>
                setFilters({
                  ...filters,
                  classification: e.target
                    .value as LibraryFilters["classification"],
                })
              }
            >
              <option value="">All types</option>
              <option value="manual">Manual</option>
              <option value="automated">Automated</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => load(1, filters)}
            >
              Filter
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !rows.length}
              onClick={() => addCases(rows)}
            >
              Import visible cases
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !filters.group}
              onClick={importGroup}
            >
              Import whole group
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Selections persist across filters and pages. Import whole group
            includes all active cases in the folder and its subfolders
            regardless of search filters. Later additions to the library group
            are not automatically included.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </CardContent>
        <div className="max-h-[520px] overflow-auto border-t">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Include</span>
                </th>
                <th>ID</th>
                <th>CASE</th>
                <th>GROUP</th>
                <th>PRIORITY</th>
                <th>TYPE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Include ${c.title}`}
                      checked={selected.has(c.id)}
                      disabled={
                        pending ||
                        (!selected.has(c.id) && selected.size >= 1000)
                      }
                      onChange={(e) => {
                        if (e.target.checked) addCases([c]);
                        else {
                          const next = new Map(selected);
                          next.delete(c.id);
                          setSelected(next);
                        }
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {code}-{c.number}
                  </td>
                  <td>{c.title}</td>
                  <td>{c.suites?.name ?? "Ungrouped"}</td>
                  <td>
                    <StatusBadge status={c.priority} />
                  </td>
                  <td>{c.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              No matching active cases.
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
          <span>
            {count} matching cases · Page {page} of{" "}
            {Math.max(1, Math.ceil(count / 100))}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || page <= 1}
              onClick={() => load(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || page * 100 >= count}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Included cases ({selected.size})</CardTitle>
        </CardHeader>
        <CardContent>
          {!selected.size ? (
            <p className="text-sm text-muted-foreground">
              Import cases now or save an empty draft plan.
            </p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-auto">
              {[...selected.values()]
                .sort((a, b) => a.number - b.number)
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 border-b pb-2 text-sm"
                  >
                    <span>
                      {code}-{c.number} · {c.title}{" "}
                      <span className="text-muted-foreground">
                        ({c.suites?.name ?? "Ungrouped"}
                        {c.archived_at ? "; archived case" : ""})
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${c.title}`}
                      disabled={pending}
                      onClick={() => {
                        const next = new Map(selected);
                        next.delete(c.id);
                        setSelected(next);
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </ActionForm>
  );
}
