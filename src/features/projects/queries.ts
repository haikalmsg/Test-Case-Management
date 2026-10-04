import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
export async function getProject(id: string) {
  const { client } = await requireMember();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  assertOk(error);
  if (!data) notFound();
  return data;
}
