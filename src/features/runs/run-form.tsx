"use client";
import { useState, useTransition } from "react";
import { ActionForm, Field } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared";
import { createRun, findRunCases } from "./actions";
type Case = { id: string; number: number; title: string; priority: string };
export function RunForm({
  projectId,
  code,
  cases,
  total,
}: {
  projectId: string;
  code: string;
  cases: Case[];
  total: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(cases);
  const [count, setCount] = useState(total);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  function load(nextPage: number) {
    startTransition(async () => {
      const result = await findRunCases({
        projectId,
        query: search,
        page: nextPage,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
      setCount(result.count);
      setPage(nextPage);
      setError(undefined);
    });
  }
  return (
    <ActionForm
      action={createRun}
      submit="Create & start run"
      className="space-y-6"
    >
      <input type="hidden" name="project_id" value={projectId} />
      {Array.from(selected).map((id) => (
        <input type="hidden" key={id} name="case_ids" value={id} />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Run details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Run name" htmlFor="name">
            <Input
              id="name"
              name="name"
              placeholder="e.g. Release 1.0 · Smoke test"
              maxLength={160}
              required
            />
          </Field>
          <Field label="Environment (optional)" htmlFor="environment">
            <Input
              id="environment"
              name="environment"
              placeholder="e.g. Staging · Chrome"
              maxLength={200}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Select test cases</CardTitle>
          <span className="text-xs text-muted-foreground">
            {selected.size} / 1,000 selected
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load(1);
                }
              }}
              aria-label="Find cases to include"
              placeholder="Find a case by title…"
              maxLength={200}
              className="min-w-56 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => load(1)}
            >
              {pending ? "Searching…" : "Search"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || selected.size >= 1000}
              onClick={() =>
                setSelected(
                  new Set(
                    [...selected, ...rows.map((c) => c.id)].slice(0, 1000),
                  ),
                )
              }
            >
              Select visible
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Selections are kept while you search or change pages.
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
                <th className="w-12">
                  <span className="sr-only">Select</span>
                </th>
                <th>ID</th>
                <th>TITLE</th>
                <th>PRIORITY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={!selected.has(c.id) && selected.size >= 1000}
                      aria-label={`Include ${c.title}`}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">
                    {code}-{c.number}
                  </td>
                  <td className="font-medium">{c.title}</td>
                  <td>
                    <StatusBadge status={c.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No matching cases.
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <span className="text-xs text-muted-foreground">
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
    </ActionForm>
  );
}
