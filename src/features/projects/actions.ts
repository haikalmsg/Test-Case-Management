"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  readForm,
  assertOk,
  actionError,
  type ActionState,
  uuid,
} from "@/lib/actions";
const projectSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9]{1,9}$/,
      "Use 2–10 uppercase letters or digits, starting with a letter.",
    ),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(10000),
});
export async function saveProject(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { id, ...values } = readForm(projectSchema, form);
    if (id) {
      const { data, error } = await client
        .from("projects")
        .update({ name: values.name, description: values.description })
        .eq("id", id)
        .select("id")
        .single();
      assertOk(error);
      if (!data) throw new Error("Project unavailable.");
    } else assertOk((await client.from("projects").insert(values)).error);
    revalidatePath("/", "layout");
    return { success: id ? "Project updated." : "Project created." };
  } catch (error) {
    return actionError(error);
  }
}
export async function archiveProject(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk(
      (
        await client
          .from("projects")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .single()
      ).error,
    );
    revalidatePath("/", "layout");
    return { success: "Project archived. Its test history is preserved." };
  } catch (error) {
    return actionError(error);
  }
}
