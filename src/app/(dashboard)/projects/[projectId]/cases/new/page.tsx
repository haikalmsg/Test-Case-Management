import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getProject } from "@/features/projects/queries";
import { assertOk } from "@/lib/actions";
import { PageHeader } from "@/components/shared";
import { CaseForm } from "@/features/repository/case-form";
export default async function NewCase({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (project.archived_at) redirect(`/projects/${projectId}/cases`);
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
        eyebrow={`${project.code} / Repository`}
        title="New test case"
        description="Write it once. Test it with confidence."
      />
      <CaseForm projectId={projectId} suites={data ?? []} />
    </div>
  );
}
