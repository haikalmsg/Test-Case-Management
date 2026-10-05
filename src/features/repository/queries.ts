import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { withGroupPaths, type CaseGroup } from "./groups";

export async function getCaseGroups(projectId: string): Promise<CaseGroup[]> {
  const { client } = await requireMember();
  const groups: CaseGroup[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("suites")
      .select("id,name,parent_id,description,archived_at")
      .eq("project_id", projectId)
      .order("name")
      .order("id")
      .range(offset, offset + 999);
    assertOk(error);
    groups.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return groups;
  }
}
export async function getCase(projectId: string, caseId: string) {
  const { client } = await requireMember();
  const { data, error } = await client
    .from("test_cases")
    .select("*,suites(id,name),case_steps(*)")
    .eq("id", caseId)
    .eq("project_id", projectId)
    .maybeSingle();
  assertOk(error);
  if (!data) notFound();
  data.case_steps.sort((a, b) => a.position - b.position);
  return withGroupPaths([data], await getCaseGroups(projectId))[0];
}
