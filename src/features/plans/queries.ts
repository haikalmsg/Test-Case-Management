import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getCaseGroups } from "@/features/repository/queries";
import { groupOptions, withGroupPaths } from "@/features/repository/groups";

export type LibraryFilters = {
  projectId: string;
  query: string;
  group: string;
  priority: "" | Database["public"]["Enums"]["case_priority"];
  classification: "" | Database["public"]["Enums"]["case_classification"];
};
export type LibraryCase = {
  id: string;
  number: number;
  title: string;
  priority: string;
  classification: string;
  archived_at: string | null;
  suites: { id: string; name: string } | null;
};
export function libraryQuery(
  client: SupabaseClient<Database>,
  filters: LibraryFilters,
  groupIds?: string[],
) {
  let query = client
    .from("test_cases")
    .select(
      "id,number,title,priority,classification,archived_at,suites(id,name)",
      { count: "exact" },
    )
    .eq("project_id", filters.projectId)
    .is("archived_at", null)
    .order("number");
  if (filters.query)
    query = query.ilike(
      "title",
      `%${filters.query.replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (filters.group === "ungrouped") query = query.is("suite_id", null);
  else if (filters.group)
    query = query.in("suite_id", groupIds?.length ? groupIds : [filters.group]);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.classification)
    query = query.eq("classification", filters.classification);
  return query;
}
export async function resolveLibraryGroup(
  client: SupabaseClient<Database>,
  filters: Pick<LibraryFilters, "projectId" | "group">,
) {
  if (!filters.group || filters.group === "ungrouped") return [];
  const { data, error } = await client.rpc("group_descendant_ids", {
    p_project_id: filters.projectId,
    p_group_id: filters.group,
  });
  assertOk(error);
  return data ?? [];
}
export async function getPlan(projectId: string, planId: string) {
  const { client } = await requireMember();
  const { data, error } = await client
    .from("test_plans")
    .select(
      "*,plan_cases(test_cases(id,number,title,priority,classification,archived_at,suites(id,name)))",
    )
    .eq("project_id", projectId)
    .eq("id", planId)
    .maybeSingle();
  assertOk(error);
  if (!data) notFound();
  const groups = await getCaseGroups(projectId);
  const cases = withGroupPaths(
    data.plan_cases
      .flatMap((row) => (row.test_cases ? [row.test_cases] : []))
      .sort((a, b) => a.number - b.number),
    groups,
  );
  return { ...data, cases };
}
export async function getPlanPicker(projectId: string, defaultGroup = "") {
  const { client } = await requireMember();
  const filters: LibraryFilters = {
    projectId,
    query: "",
    group: defaultGroup,
    priority: "",
    classification: "",
  };
  const ids = await resolveLibraryGroup(client, filters);
  const [cases, groups] = await Promise.all([
    libraryQuery(client, filters, ids).range(0, 99),
    getCaseGroups(projectId),
  ]);
  assertOk(cases.error);
  return {
    cases: withGroupPaths(cases.data ?? [], groups),
    total: cases.count ?? 0,
    groups: groupOptions(groups),
    defaultGroup,
  };
}
