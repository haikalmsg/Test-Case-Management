import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getProject } from "@/features/projects/queries";
import { getCase } from "@/features/repository/queries";
import { assertOk } from "@/lib/actions";
import { PageHeader } from "@/components/shared";
import { CaseForm } from "@/features/repository/case-form";
export default async function EditCase({
  params,
}: {
  params: Promise<{ projectId: string; caseId: string }>;
}) {
  const { projectId, caseId } = await params;
  const project = await getProject(projectId);
  const item = await getCase(projectId, caseId);
  if (project.archived_at || item.archived_at)
    redirect(`/projects/${projectId}/cases/${caseId}`);
  const { client } = await requireMember();
  const { data, error } = await client
    .from("suites")
    .select("id,name")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("name");
  assertOk(error);
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={`${project.code}-${item.number}`}
        title="Edit test case"
        description="Changes apply to the repository. Existing runs keep their snapshots."
      />
      <CaseForm
        projectId={projectId}
        suites={data ?? []}
        initial={item}
        steps={item.case_steps}
      />
    </div>
  );
}
