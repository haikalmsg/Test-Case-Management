import { redirect } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { RunForm } from "@/features/runs/run-form";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
export default async function NewRun({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (project.archived_at) redirect(`/projects/${projectId}/runs`);
  const { client } = await requireMember();
  const { data, error, count } = await client
    .from("test_cases")
    .select("id,number,title,priority", { count: "exact" })
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("number")
    .limit(100);
  assertOk(error);
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Execution`}
        title="Start a test run"
        description="Choose the cases to execute. This run keeps a snapshot of every case."
      />
      {data?.length ? (
        <RunForm
          projectId={projectId}
          code={project.code}
          cases={data}
          total={count ?? 0}
        />
      ) : (
        <Card>
          <EmptyState
            title="Add some cases first"
            description="Create test cases in the repository before starting your first run."
            href={`/projects/${projectId}/cases/new`}
            label="Create a case"
          />
        </Card>
      )}
    </>
  );
}
