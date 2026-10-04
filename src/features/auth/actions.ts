"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { appUrl, isConfigured } from "@/lib/env";
import {
  readForm,
  assertOk,
  actionError,
  type ActionState,
} from "@/lib/actions";
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!isConfigured())
    return { error: "Configure Supabase first. Follow the README." };
  try {
    const values = readForm(
      z.object({
        email: z.email(),
        password: z.string().min(1, "Enter your password."),
      }),
      form,
    );
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword(values);
    if (error) return { error: "The email or password is incorrect." };
  } catch (error) {
    return actionError(error);
  }
  redirect("/dashboard");
}
export async function logout() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/login");
}
export async function requestReset(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { email } = readForm(z.object({ email: z.email() }), form);
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}/update-password?flow=recovery`,
    });
    assertOk(error);
    return {
      success:
        "If an account exists, a password reset link will arrive by email.",
    };
  } catch (error) {
    return actionError(error);
  }
}
export async function updatePassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireUser();
  try {
    const { password, confirmation, flow } = readForm(
      z.object({
        password: z.string().min(8, "Use at least 8 characters."),
        confirmation: z.string(),
        flow: z.enum(["invite", "recovery"]),
      }),
      form,
    );
    if (password !== confirmation) return { error: "Passwords do not match." };
    assertOk((await client.auth.updateUser({ password })).error);
    if (flow === "invite")
      assertOk((await client.rpc("accept_invitation")).error);
  } catch (error) {
    return actionError(error);
  }
  redirect("/dashboard");
}
