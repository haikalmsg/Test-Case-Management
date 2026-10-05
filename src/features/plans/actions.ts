"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import {
  readForm,
  actionError,
  assertOk,
  uuid,
  type ActionState,
} from "@/lib/actions";
import { libraryQuery, resolveLibraryGroup } from "./queries";
import { getCaseGroups } from "@/features/repository/queries";
import { withGroupPaths } from "@/features/repository/groups";

export async function savePlan(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  let planId: string;
  let projectId: string;
  try {
    const v = readForm(
      z.object({
        project_id: uuid,
        id: z.union([uuid, z.literal("")]).optional(),
        name: z.string().trim().min(1).max(160),
        description: z.string().max(10000),
      }),
      form,
    );
    projectId = v.project_id;
    const ids = z.array(uuid).max(1000).parse(form.getAll("case_ids"));
    const { data, error } = await client.rpc("save_plan", {
      p_project_id: projectId,
      p_plan_id: v.id || undefined,
      p_name: v.name,
      p_description: v.description,
      p_case_ids: ids,
    });
    assertOk(error);
    planId = data!;
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect(`/projects/${projectId}/plans/${planId}`);
}
export async function archivePlan(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk((await client.rpc("archive_plan", { p_plan_id: id })).error);
    revalidatePath("/", "layout");
    return {
      success:
        "Plan archived. Its run history is preserved; active runs can still be finished.",
    };
  } catch (error) {
    return actionError(error);
  }
}
export async function findLibraryCases(input: unknown) {
  const { client } = await requireMember();
  try {
    const v = z
      .object({
        projectId: uuid,
        query: z.string().trim().max(200),
        group: z.union([uuid, z.literal(""), z.literal("ungrouped")]),
        priority: z.enum(["", "low", "medium", "high", "critical"]),
        classification: z.enum(["", "manual", "automated"]),
        page: z.number().int().min(1).max(100000),
      })
      .parse(input);
    const ids = await resolveLibraryGroup(client, v);
    const { data, error, count } = await libraryQuery(client, v, ids).range(
      (v.page - 1) * 100,
      v.page * 100 - 1,
    );
    assertOk(error);
    return {
      rows: withGroupPaths(data ?? [], await getCaseGroups(v.projectId)),
      count: count ?? 0,
    };
  } catch (error) {
    return { rows: [], count: 0, error: actionError(error).error };
  }
}
export async function importCaseGroup(input: unknown) {
  const { client } = await requireMember();
  try {
    const v = z
      .object({
        projectId: uuid,
        group: z.union([uuid, z.literal("ungrouped")]),
      })
      .parse(input);
    // Fetch the complete group within PostgREST's 1000-row limit and reject oversize groups.
    const ids = await resolveLibraryGroup(client, v);
    const result = await libraryQuery(
      client,
      {
        ...v,
        query: "",
        priority: "",
        classification: "",
      },
      ids,
    ).range(0, 999);
    assertOk(result.error);
    if ((result.count ?? 0) > 1000)
      throw new Error(
        "This group exceeds the 1,000-case plan limit. Import individual cases instead.",
      );
    return {
      rows: withGroupPaths(result.data ?? [], await getCaseGroups(v.projectId)),
    };
  } catch (error) {
    return { rows: [], error: actionError(error).error };
  }
}
