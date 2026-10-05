import { redirect } from "next/navigation";
export default async function NewRun({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/plans`);
}
