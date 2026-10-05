import { redirect } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { getCaseGroups } from "@/features/repository/queries";
import { groupOptions } from "@/features/repository/groups";
import { PageHeader } from "@/components/shared";
import { CaseForm } from "@/features/repository/case-form";
export default async function NewCase({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (project.archived_at) redirect(`/projects/${projectId}/cases`);
  const groups = groupOptions(await getCaseGroups(projectId)).filter(
    (group) => !group.archived_at,
  );
  const { group } = await searchParams;
  const defaultGroup = groups.some((folder) => folder.id === group)
    ? group
    : "";
  const options = groups.map((group) => ({ id: group.id, name: group.path }));
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={`${project.code} / Repository`}
        title="New test case"
        description="Write it once. Test it with confidence."
      />
      <CaseForm
        projectId={projectId}
        suites={options}
        defaultSuiteId={defaultGroup}
      />
    </div>
  );
}
