"use client";
import { ActionForm, Field } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createPlanRun } from "./actions";

export function RunForm({
  projectId,
  planId,
  name,
  environment,
  sourceRunId,
  mode,
}: {
  projectId: string;
  planId: string;
  name: string;
  environment: string;
  sourceRunId?: string;
  mode: "all" | "unsuccessful";
}) {
  return (
    <ActionForm
      action={createPlanRun}
      submit={sourceRunId ? "Start rerun" : "Start run"}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="source_run_id" value={sourceRunId ?? ""} />
      <input type="hidden" name="mode" value={mode} />
      <Card>
        <CardHeader>
          <CardTitle>Execution details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Run name" htmlFor="run-name">
            <Input
              id="run-name"
              name="name"
              defaultValue={name.slice(0, 160)}
              maxLength={160}
              required
            />
          </Field>
          <Field label="Environment (optional)" htmlFor="environment">
            <Input
              id="environment"
              name="environment"
              defaultValue={environment}
              placeholder="e.g. Staging · Chrome"
              maxLength={200}
            />
          </Field>
        </CardContent>
      </Card>
    </ActionForm>
  );
}
