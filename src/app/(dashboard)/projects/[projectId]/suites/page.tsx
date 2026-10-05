import { redirect } from "next/navigation";
// Preserve old bookmarks while group management lives entirely in the library.
export default async function Suites({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/cases`);
}
