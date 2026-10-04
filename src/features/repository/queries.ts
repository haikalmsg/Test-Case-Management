import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
export async function getCase(projectId: string, caseId: string) {
  const { client } = await requireMember();
  const { data, error } = await client
    .from("test_cases")
    .select("*,suites(name),case_steps(*)")
    .eq("id", caseId)
    .eq("project_id", projectId)
    .maybeSingle();
  assertOk(error);
  if (!data) notFound();
  data.case_steps.sort((a, b) => a.position - b.position);
  return data;
}
