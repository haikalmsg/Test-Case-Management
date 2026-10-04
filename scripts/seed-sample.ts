import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/lib/supabase/database.types";
config({ path: ".env.local", quiet: true });
const client = createClient<Database>(
  z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
  z.string().min(1).parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  { auth: { persistSession: false } },
);
const { error: authError } = await client.auth.signInWithPassword({
  email: z.email().parse(process.env.SEED_ADMIN_EMAIL),
  password: z.string().min(1).parse(process.env.SEED_ADMIN_PASSWORD),
});
if (authError) throw authError;
const { data: existing, error: existingError } = await client
  .from("projects")
  .select("id")
  .eq("code", "DEMO")
  .maybeSingle();
if (existingError) throw existingError;
if (existing)
  throw new Error(
    "A DEMO project already exists. Sample data is never overwritten.",
  );
const { data: project, error } = await client
  .from("projects")
  .insert({
    code: "DEMO",
    name: "Customer Portal",
    description:
      "Sample coverage for a customer portal. Safe to archive when your real testing begins.",
  })
  .select()
  .single();
if (error) throw error;
const { data: suite, error: suiteError } = await client
  .from("suites")
  .insert({
    project_id: project!.id,
    name: "Authentication",
    description: "Sign-in and account access.",
  })
  .select()
  .single();
if (suiteError) throw suiteError;
const definitions = [
  [
    "A user can sign in with valid credentials",
    "high",
    "Open the sign-in page and enter valid credentials.",
    "The user arrives at their dashboard.",
  ],
  [
    "An incorrect password is rejected",
    "critical",
    "Enter a registered email with an incorrect password.",
    "An error appears and the user remains signed out.",
  ],
  [
    "A user can request a password reset",
    "medium",
    "Request a reset for a registered email.",
    "A password reset email arrives.",
  ],
] as const;
const ids: string[] = [];
for (const [title, priority, action, expected_result] of definitions) {
  const result = await client.rpc("save_case", {
    p_project_id: project!.id,
    p_title: title,
    p_description: "Sample test case",
    p_preconditions: "A registered test user exists.",
    p_priority: priority,
    p_classification: "manual",
    p_suite_id: suite!.id,
    p_steps: [{ action, expected_result }],
  });
  if (result.error) throw result.error;
  ids.push(result.data!);
}
const run = await client.rpc("create_run", {
  p_project_id: project!.id,
  p_name: "Portal smoke test",
  p_environment: "Staging",
  p_case_ids: ids,
});
if (run.error) throw run.error;
await client.auth.signOut();
console.log("Created DEMO project, suite, three cases, and an active run.");
