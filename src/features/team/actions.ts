"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import {
  readForm,
  assertOk,
  actionError,
  type ActionState,
  uuid,
} from "@/lib/actions";
export async function inviteMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { email, role } = readForm(
      z.object({
        email: z.email().transform((v) => v.trim().toLowerCase()),
        role: z.enum(["admin", "member"]),
      }),
      form,
    );
    const admin = createAdminClient();
    assertOk(
      (await client.rpc("prepare_invitation", { p_email: email, p_role: role }))
        .error,
    );
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl()}/update-password?flow=invite`,
    });
    if (error) {
      if (
        error.code === "email_exists" ||
        error.code === "user_already_exists"
      ) {
        const resent = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${appUrl()}/update-password?flow=invite`,
        });
        assertOk(resent.error);
      } else {
        revalidatePath("/team");
        return {
          error: `Invitation saved, but delivery failed: ${error.message}. You can retry from the invitation list.`,
        };
      }
    }
    revalidatePath("/team");
    return {
      success:
        "Invitation email sent. The recipient must set a password to join.",
    };
  } catch (error) {
    revalidatePath("/team");
    return actionError(error);
  }
}
export async function manageMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { user_id, role, active } = readForm(
      z.object({
        user_id: uuid,
        role: z.enum(["admin", "member"]),
        active: z.enum(["true", "false"]).transform((v) => v === "true"),
      }),
      form,
    );
    assertOk(
      (
        await client.rpc("manage_member", {
          p_user_id: user_id,
          p_role: role,
          p_active: active,
        })
      ).error,
    );
    revalidatePath("/", "layout");
    return { success: "Membership updated." };
  } catch (error) {
    return actionError(error);
  }
}
export async function revokeInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { id } = readForm(z.object({ id: uuid }), form);
    assertOk(
      (await client.rpc("revoke_invitation", { p_invitation_id: id })).error,
    );
    revalidatePath("/team");
    return { success: "Invitation revoked." };
  } catch (error) {
    return actionError(error);
  }
}
export async function saveWorkspace(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireAdmin();
  try {
    const { name } = readForm(
      z.object({ name: z.string().trim().min(1).max(100) }),
      form,
    );
    assertOk(
      (
        await client
          .from("workspace_settings")
          .update({ name })
          .eq("id", true)
          .select("id")
          .single()
      ).error,
    );
    revalidatePath("/", "layout");
    return { success: "Workspace updated." };
  } catch (error) {
    return actionError(error);
  }
}
