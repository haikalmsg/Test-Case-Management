import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isConfigured } from "./env";
import { createClient } from "./supabase/server";
export const requireUser = cache(async () => {
  if (!isConfigured()) redirect("/setup");
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return { client, user };
});
export const requireMember = cache(async () => {
  const { client, user } = await requireUser();
  const { data: member, error } = await client
    .from("memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("Unable to verify team membership.");
  if (!member) redirect("/access-denied");
  return { client, user, member };
});
export async function requireAdmin() {
  const session = await requireMember();
  if (session.member.role !== "admin") redirect("/dashboard");
  return session;
}
