import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";
import type { Database } from "../src/lib/supabase/database.types";
config({ path: ".env.local", quiet: true });
const url = z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { count, error } = await client
  .from("memberships")
  .select("*", { count: "exact", head: true })
  .eq("role", "admin")
  .eq("active", true);
if (error) throw error;
if (count)
  throw new Error(
    "An active admin already exists. Manage the team in the app instead.",
  );
const rl = createInterface({ input: stdin, output: stdout });
const email = z
  .email()
  .parse(
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
      (await rl.question("First admin email: ")),
  );
const name = (
  process.env.BOOTSTRAP_ADMIN_NAME || (await rl.question("Full name: "))
).trim();
rl.close();
// Passwords come from an environment variable, not terminal arguments or echoed prompts.
const password = z
  .string()
  .min(8, "Set BOOTSTRAP_ADMIN_PASSWORD to at least 8 characters.")
  .parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
const { data: created, error: createError } =
  await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
if (createError) throw createError;
if (!created.user) throw new Error("User creation failed.");
const { error: membershipError } = await client
  .from("memberships")
  .insert({ user_id: created.user.id, role: "admin", active: true });
if (membershipError) {
  await client.auth.admin.deleteUser(created.user.id);
  throw membershipError;
}
console.log(`First admin created: ${email}. Sign in at your app URL.`);
