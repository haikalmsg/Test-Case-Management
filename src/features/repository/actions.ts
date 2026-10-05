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
const stepsSchema = z
  .array(
    z.object({
      action: z.string().trim().min(1, "Each step needs an action.").max(5000),
      expected_result: z
        .string()
        .trim()
        .min(1, "Each step needs an expected result.")
        .max(5000),
    }),
  )
  .max(100);
const caseSchema = z.object({
  project_id: uuid,
  id: z.union([uuid, z.literal("")]).optional(),
  title: z.string().trim().min(1, "Enter a title.").max(200),
  description: z.string().max(10000),
  preconditions: z.string().max(10000),
  priority: z.enum(["low", "medium", "high", "critical"]),
  classification: z.enum(["manual", "automated"]),
  suite_id: z.union([uuid, z.literal("")]),
  steps: z.string(),
});
export async function saveCase(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  let id: string;
  let projectId: string;
  try {
    const v = readForm(caseSchema, form);
    projectId = v.project_id;
    const steps = stepsSchema.parse(JSON.parse(v.steps));
    const { data, error } = await client.rpc("save_case", {
      p_project_id: v.project_id,
      p_title: v.title,
      p_description: v.description,
      p_preconditions: v.preconditions,
      p_priority: v.priority,
      p_classification: v.classification,
      p_suite_id: v.suite_id || undefined,
      p_steps: steps,
      p_case_id: v.id || undefined,
    });
    assertOk(error);
    id = data!;
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect(`/projects/${projectId}/cases/${id}`);
}
export async function archiveCase(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk((await client.rpc("archive_case", { p_case_id: id })).error);
    revalidatePath("/", "layout");
    return { success: "Case archived. Existing runs keep their snapshots." };
  } catch (error) {
    return actionError(error);
  }
}
export async function duplicateCase(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  let projectId: string;
  let id: string;
  try {
    const v = readForm(z.object({ id: uuid }), form);
    const { data: original, error } = await client
      .from("test_cases")
      .select("*,case_steps(action,expected_result,position)")
      .eq("id", v.id)
      .is("archived_at", null)
      .single();
    assertOk(error);
    if (!original) throw new Error("Case unavailable.");
    projectId = original.project_id;
    const { data, error: copyError } = await client.rpc("save_case", {
      p_project_id: projectId,
      p_title: `Copy of ${original.title}`.slice(0, 200),
      p_description: original.description,
      p_preconditions: original.preconditions,
      p_priority: original.priority,
      p_classification: original.classification,
      p_suite_id: original.suite_id ?? undefined,
      p_steps: original.case_steps
        .sort((a, b) => a.position - b.position)
        .map(({ action, expected_result }) => ({ action, expected_result })),
      p_case_id: undefined,
    });
    assertOk(copyError);
    id = data!;
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect(`/projects/${projectId}/cases/${id}`);
}
export async function saveSuite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const { id, project_id, parent_id, ...values } = readForm(
      z.object({
        id: z.union([uuid, z.literal("")]).optional(),
        project_id: uuid,
        parent_id: z.union([uuid, z.literal("")]).optional(),
        name: z.string().trim().min(1).max(120),
        description: z.string().max(10000),
      }),
      form,
    );
    assertOk(
      (
        await client.rpc("save_group", {
          p_project_id: project_id,
          p_group_id: id || undefined,
          p_name: values.name,
          p_description: values.description,
          p_parent_id: parent_id || undefined,
        })
      ).error,
    );
    revalidatePath("/", "layout");
    return { success: id ? "Folder updated." : "Folder created." };
  } catch (error) {
    return actionError(error);
  }
}
export async function archiveSuite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireMember();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk((await client.rpc("archive_group", { p_group_id: id })).error);
    revalidatePath("/", "layout");
    return {
      success:
        "Folder and subfolders archived. Their cases remain in the library.",
    };
  } catch (error) {
    return actionError(error);
  }
}
