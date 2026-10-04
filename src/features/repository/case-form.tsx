"use client";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { ActionForm, Field } from "@/components/forms";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCase } from "./actions";
import type { Tables } from "@/lib/supabase/database.types";
type Step = { action: string; expected_result: string; key: string };
export function CaseForm({
  projectId,
  suites,
  initial,
  steps = [],
}: {
  projectId: string;
  suites: { id: string; name: string }[];
  initial?: Tables<"test_cases">;
  steps?: { action: string; expected_result: string }[];
}) {
  const [rows, setRows] = useState<Step[]>(
    steps.map((s, i) => ({ ...s, key: String(i) })),
  );
  function update(
    index: number,
    field: "action" | "expected_result",
    value: string,
  ) {
    setRows(rows.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }
  function move(index: number, direction: number) {
    const next = [...rows];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setRows(next);
  }
  return (
    <ActionForm
      action={saveCase}
      submit={initial ? "Save changes" : "Create test case"}
      className="space-y-6"
    >
      <input name="project_id" type="hidden" value={projectId} />
      <input name="id" type="hidden" value={initial?.id ?? ""} />
      <input
        name="steps"
        type="hidden"
        value={JSON.stringify(
          rows.map(({ action, expected_result }) => ({
            action,
            expected_result,
          })),
        )}
      />
      <Card>
        <CardHeader>
          <CardTitle>Case details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              name="title"
              defaultValue={initial?.title}
              placeholder="e.g. A user can sign in with valid credentials"
              maxLength={200}
              required
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Suite" htmlFor="suite_id">
              <Select
                id="suite_id"
                name="suite_id"
                defaultValue={
                  suites.some((s) => s.id === initial?.suite_id)
                    ? (initial?.suite_id ?? "")
                    : ""
                }
              >
                <option value="">No suite</option>
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="priority">
              <Select
                id="priority"
                name="priority"
                defaultValue={initial?.priority ?? "medium"}
              >
                {["low", "medium", "high", "critical"].map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Classification" htmlFor="classification">
              <Select
                id="classification"
                name="classification"
                defaultValue={initial?.classification ?? "manual"}
              >
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description}
              maxLength={10000}
              placeholder="Describe the behavior being tested."
            />
          </Field>
          <Field label="Preconditions" htmlFor="preconditions">
            <Textarea
              id="preconditions"
              name="preconditions"
              defaultValue={initial?.preconditions}
              maxLength={10000}
              placeholder="What should be true before starting?"
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Test steps</CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length}/100 steps
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? (
            rows.map((row, i) => (
              <div
                key={row.key}
                className="rounded-lg border bg-slate-50/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    STEP {i + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      aria-label={`Move step ${i + 1} up`}
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={`Move step ${i + 1} down`}
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      aria-label={`Remove step ${i + 1}`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Action" htmlFor={`action-${row.key}`}>
                    <Textarea
                      id={`action-${row.key}`}
                      value={row.action}
                      onChange={(e) => update(i, "action", e.target.value)}
                      maxLength={5000}
                      required
                    />
                  </Field>
                  <Field
                    label="Expected result"
                    htmlFor={`expected-${row.key}`}
                  >
                    <Textarea
                      id={`expected-${row.key}`}
                      value={row.expected_result}
                      onChange={(e) =>
                        update(i, "expected_result", e.target.value)
                      }
                      maxLength={5000}
                      required
                    />
                  </Field>
                </div>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Add steps to make this case easy to repeat.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={rows.length >= 100}
            onClick={() =>
              setRows([
                ...rows,
                { key: crypto.randomUUID(), action: "", expected_result: "" },
              ])
            }
          >
            <Plus className="size-4" />
            Add step
          </Button>
        </CardContent>
      </Card>
    </ActionForm>
  );
}
