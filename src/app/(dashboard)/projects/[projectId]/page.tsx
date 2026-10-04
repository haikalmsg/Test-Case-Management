import { redirect } from "next/navigation";
export default async function Project({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/cases`);
}
