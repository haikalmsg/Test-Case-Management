import { z } from "zod";
export type ActionState = { error?: string; success?: string };
export const uuid = z.uuid();
export function readForm<T extends z.ZodType>(
  schema: T,
  form: FormData,
): z.infer<T> {
  return schema.parse(Object.fromEntries(form));
}
export function actionError(error: unknown): ActionState {
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Please check the form." };
  if (error instanceof Error) return { error: error.message };
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return { error: error.message };
  return { error: "Unable to save. Please try again." };
}
export function assertOk(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
