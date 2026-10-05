import { redirect } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { getCase, getCaseGroups } from "@/features/repository/queries";
import { groupOptions } from "@/features/repository/groups";
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
  const groups = groupOptions(await getCaseGroups(projectId)).filter(
    (group) => !group.archived_at,
  );
  const options = groups.map((group) => ({ id: group.id, name: group.path }));
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={`${project.code}-${item.number}`}
        title="Edit test case"
        description="Changes apply to the repository. Existing runs keep their snapshots."
      />
      <CaseForm
        projectId={projectId}
        suites={options}
        initial={item}
        steps={item.case_steps}
      />
    </div>
  );
}
