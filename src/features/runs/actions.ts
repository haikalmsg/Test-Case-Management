"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import {
  readForm,
  actionError,
  assertOk,
  type ActionState,
  uuid,
} from "@/lib/actions";
export async function createRun(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  let runId: string;
  let projectId: string;
  try {
    const v = readForm(
      z.object({
        project_id: uuid,
        name: z.string().trim().min(1).max(160),
        environment: z.string().trim().max(200),
      }),
      form,
    );
    projectId = v.project_id;
    const caseIds = z
      .array(uuid)
      .min(1, "Select at least one case.")
      .max(1000)
      .parse(form.getAll("case_ids"));
    const { data, error } = await client.rpc("create_run", {
      p_project_id: projectId,
      p_name: v.name,
      p_environment: v.environment,
      p_case_ids: caseIds,
    });
    assertOk(error);
    runId = data!;
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect(`/projects/${projectId}/runs/${runId}`);
}
export async function recordResult(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const v = readForm(
      z.object({
        id: uuid,
        status: z.enum(["untested", "passed", "failed", "blocked", "skipped"]),
        notes: z.string().max(10000),
      }),
      form,
    );
    assertOk(
      (
        await client.rpc("record_result", {
          p_run_case_id: v.id,
          p_status: v.status,
          p_notes: v.notes,
        })
      ).error,
    );
    revalidatePath("/", "layout");
    return { success: "Result saved." };
  } catch (error) {
    return actionError(error);
  }
}
export async function completeRun(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk((await client.rpc("complete_run", { p_run_id: id })).error);
    revalidatePath("/", "layout");
    return { success: "Run completed. Results are now read-only." };
  } catch (error) {
    return actionError(error);
  }
}

export async function findRunCases(input: {
  projectId: string;
  query: string;
  page: number;
}) {
  const { client } = await requireMember();
  try {
    const v = z
      .object({
        projectId: uuid,
        query: z.string().trim().max(200),
        page: z.number().int().min(1).max(100000),
      })
      .parse(input);
    let query = client
      .from("test_cases")
      .select("id,number,title,priority", { count: "exact" })
      .eq("project_id", v.projectId)
      .is("archived_at", null)
      .order("number");
    if (v.query)
      query = query.ilike("title", `%${v.query.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error, count } = await query.range(
      (v.page - 1) * 100,
      v.page * 100 - 1,
    );
    assertOk(error);
    return { rows: data ?? [], count: count ?? 0 };
  } catch (error) {
    return { rows: [], count: 0, error: actionError(error).error };
  }
}
