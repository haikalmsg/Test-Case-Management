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
export async function createPlanRun(
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
        plan_id: uuid,
        source_run_id: z.union([uuid, z.literal("")]),
        mode: z.enum(["all", "unsuccessful"]),
        name: z.string().trim().min(1).max(160),
        environment: z.string().trim().max(200),
      }),
      form,
    );
    projectId = v.project_id;
    const plan = await client
      .from("test_plans")
      .select("id")
      .eq("id", v.plan_id)
      .eq("project_id", projectId)
      .single();
    assertOk(plan.error);
    const { data, error } = await client.rpc("create_plan_run", {
      p_plan_id: v.plan_id,
      p_name: v.name,
      p_environment: v.environment,
      p_source_run_id: v.source_run_id || undefined,
      p_mode: v.mode,
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
