import { z } from "zod";
import { redirect } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { getPlanPicker } from "@/features/plans/queries";
import { PlanForm } from "@/features/plans/plan-form";
import { PageHeader } from "@/components/shared";

export default async function NewPlan({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (project.archived_at) redirect(`/projects/${projectId}/plans`);
  const { group } = await searchParams;
  const picker = await getPlanPicker(
    projectId,
    z.uuid().safeParse(group).success ? group : "",
  );
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Planning`}
        title="New test plan"
        description="Import reusable cases individually or from a library group."
      />
      <PlanForm projectId={projectId} code={project.code} {...picker} />
    </>
  );
}
