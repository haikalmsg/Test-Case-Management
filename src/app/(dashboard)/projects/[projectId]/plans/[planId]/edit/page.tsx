import { redirect } from "next/navigation";
import { getProject } from "@/features/projects/queries";
import { getPlan, getPlanPicker } from "@/features/plans/queries";
import { PlanForm } from "@/features/plans/plan-form";
import { PageHeader } from "@/components/shared";

export default async function EditPlan({
  params,
}: {
  params: Promise<{ projectId: string; planId: string }>;
}) {
  const { projectId, planId } = await params;
  const [project, plan] = await Promise.all([
    getProject(projectId),
    getPlan(projectId, planId),
  ]);
  if (project.archived_at || plan.archived_at)
    redirect(`/projects/${projectId}/plans/${planId}`);
  const picker = await getPlanPicker(projectId);
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Planning`}
        title="Edit test plan"
        description="Changing this plan leaves earlier run snapshots and results intact."
      />
      <PlanForm
        projectId={projectId}
        code={project.code}
        {...picker}
        plan={plan}
      />
    </>
  );
}
