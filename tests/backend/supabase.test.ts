import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import type { Database } from "../../src/lib/supabase/database.types";
config({ path: ".env.local", quiet: true });
const status = JSON.parse(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Backend tests only run against local Supabase.");
if (new URL(url).origin !== new URL(status.API_URL).origin)
  throw new Error(
    "Environment must point at the running local Supabase instance.",
  );
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const service = createClient<Database>(
  url,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const password = `Tcm-${randomUUID()}!`;
const prefix = randomUUID().slice(0, 8);
const ids: string[] = [];
const emails: string[] = [];
let projectId: string | undefined;
function userClient() {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function account(label: string, role?: "admin" | "member") {
  const email = `tcm-${prefix}-${label}@example.com`;
  emails.push(email);
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  const id = created.data.user!.id;
  ids.push(id);
  if (role) {
    const membership = await service
      .from("memberships")
      .insert({ user_id: id, role });
    assert.equal(membership.error, null);
  }
  const client = userClient();
  assert.equal(
    (await client.auth.signInWithPassword({ email, password })).error,
    null,
  );
  return { email, id, client };
}
async function emailLink(email: string) {
  const mailUrl = status.MAILPIT_URL || status.INBUCKET_URL;
  for (let attempt = 0; attempt < 40; attempt++) {
    const inbox = await (await fetch(`${mailUrl}/api/v1/messages`)).json();
    const message = inbox.messages?.find((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address === email),
    );
    if (message) {
      const content = await (
        await fetch(`${mailUrl}/api/v1/message/${message.ID}`)
      ).json();
      const html = content.HTML || content.Text;
      const match = html.match(/https?:[^"\s<>]+token_hash[^"\s<>]+/);
      if (match) return new URL(match[0].replaceAll("&amp;", "&"));
    }
    await delay(250);
  }
  throw new Error(`No auth email delivered for ${email}`);
}
async function cleanup() {
  const pg = new PgClient({ connectionString: status.DB_URL });
  await pg.connect();
  try {
    await pg.query("begin");
    if (projectId) {
      await pg.query("delete from public.run_cases where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.test_runs where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.test_cases where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.suites where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.projects where id=$1", [projectId]);
    }
    await pg.query(
      "delete from public.invitations where email=any($1::text[]) or invited_by=any($2::uuid[])",
      [emails, ids],
    );
    // This transaction locks the table while removing only this test's fixtures.
    await pg.query(
      "alter table public.memberships disable trigger protect_last_admin",
    );
    await pg.query(
      "delete from public.memberships where user_id=any($1::uuid[])",
      [ids],
    );
    await pg.query(
      "alter table public.memberships enable trigger protect_last_admin",
    );
    await pg.query("delete from auth.users where id=any($1::uuid[])", [ids]);
    await pg.query("commit");
  } catch (error) {
    await pg.query("rollback");
    throw error;
  } finally {
    await pg.end();
  }
}

test(
  "Local Supabase authentication, permissions, and concurrency",
  { timeout: 60000 },
  async (t) => {
    try {
      const admin = await account("admin", "admin");
      const secondAdmin = await account("admin2", "admin");
      const member = await account("member", "member");
      const outsider = await account("outsider");
      await t.test("public signup is disabled", async () => {
        const result = await userClient().auth.signUp({
          email: `tcm-${prefix}-signup@example.com`,
          password,
        });
        assert.ok(result.error);
        assert.equal(result.error.code, "signup_disabled");
      });
      await t.test(
        "email/password sessions validate against Auth",
        async () => {
          const result = await member.client.auth.getUser();
          assert.equal(result.error, null);
          assert.equal(result.data.user?.id, member.id);
        },
      );
      const project = await admin.client
        .from("projects")
        .insert({
          name: "Backend test project",
          code: `T${prefix.slice(0, 7).toUpperCase()}`,
        })
        .select()
        .single();
      assert.equal(project.error, null);
      projectId = project.data!.id;
      await t.test(
        "nonmembers and anonymous callers cannot read team data",
        async () => {
          const hidden = await outsider.client.from("projects").select();
          assert.equal(hidden.error, null);
          assert.equal(hidden.data?.length, 0);
          const denied = await userClient().from("projects").select();
          assert.ok(denied.error);
        },
      );
      await t.test("direct role escalation is denied", async () => {
        assert.ok(
          (
            await member.client
              .from("memberships")
              .update({ role: "admin" })
              .eq("user_id", member.id)
          ).error,
        );
        assert.ok(
          (
            await member.client.rpc("manage_member", {
              p_user_id: member.id,
              p_role: "admin",
              p_active: true,
            })
          ).error,
        );
      });
      await t.test(
        "invitation email verifies identity before membership activation",
        async () => {
          const email = `tcm-${prefix}-invited@example.com`;
          emails.push(email);
          assert.equal(
            (
              await admin.client.rpc("prepare_invitation", {
                p_email: email,
                p_role: "member",
              })
            ).error,
            null,
          );
          const invited = await service.auth.admin.inviteUserByEmail(email, {
            redirectTo: "http://localhost:3000/update-password?flow=invite",
          });
          assert.equal(invited.error, null);
          ids.push(invited.data.user!.id);
          const link = await emailLink(email);
          assert.equal(link.pathname, "/auth/confirm");
          assert.equal(link.searchParams.get("flow"), "invite");
          const client = userClient();
          assert.equal(
            (
              await client.auth.verifyOtp({
                token_hash: link.searchParams.get("token_hash")!,
                type: "invite",
              })
            ).error,
            null,
          );
          const before = await client.from("projects").select();
          assert.equal(before.data?.length, 0);
          assert.equal(
            (await client.auth.updateUser({ password })).error,
            null,
          );
          assert.equal((await client.rpc("accept_invitation")).error, null);
          const after = await client.from("projects").select();
          assert.ok(after.data?.some((p) => p.id === projectId));
          assert.equal((await client.auth.signOut()).error, null);
          assert.equal(
            (await client.auth.signInWithPassword({ email, password })).error,
            null,
          );
        },
      );
      await t.test(
        "recovery emails preserve invitation intent for existing users",
        async () => {
          assert.equal(
            (
              await admin.client.rpc("prepare_invitation", {
                p_email: outsider.email,
                p_role: "member",
              })
            ).error,
            null,
          );
          assert.equal(
            (
              await userClient().auth.resetPasswordForEmail(outsider.email, {
                redirectTo: "http://localhost:3000/update-password?flow=invite",
              })
            ).error,
            null,
          );
          const link = await emailLink(outsider.email);
          assert.equal(link.searchParams.get("type"), "recovery");
          assert.equal(link.searchParams.get("flow"), "invite");
          const client = userClient();
          assert.equal(
            (
              await client.auth.verifyOtp({
                token_hash: link.searchParams.get("token_hash")!,
                type: "recovery",
              })
            ).error,
            null,
          );
          assert.equal((await client.rpc("accept_invitation")).error, null);
        },
      );
      let runId: string;
      let resultId: string;
      await t.test(
        "concurrent case creation allocates unique project numbers",
        async () => {
          const values = {
            p_project_id: projectId!,
            p_description: "",
            p_preconditions: "",
            p_priority: "medium" as const,
            p_classification: "manual" as const,
            p_steps: [],
          };
          const results = await Promise.all([
            member.client.rpc("save_case", {
              ...values,
              p_title: "Concurrent A",
            }),
            member.client.rpc("save_case", {
              ...values,
              p_title: "Concurrent B",
            }),
          ]);
          results.forEach((r) => assert.equal(r.error, null));
          const cases = await member.client
            .from("test_cases")
            .select("number")
            .in(
              "id",
              results.map((r) => r.data!),
            );
          assert.equal(cases.error, null);
          assert.equal(new Set(cases.data!.map((c) => c.number)).size, 2);
        },
      );
      await t.test(
        "run snapshots remain stable after repository edits",
        async () => {
          const created = await member.client.rpc("save_case", {
            p_project_id: projectId!,
            p_title: "Original case",
            p_description: "Description",
            p_preconditions: "Registered user",
            p_priority: "high",
            p_classification: "manual",
            p_steps: [
              { action: "Sign in", expected_result: "Dashboard appears" },
            ],
          });
          assert.equal(created.error, null);
          const run = await member.client.rpc("create_run", {
            p_project_id: projectId!,
            p_name: "Concurrent execution",
            p_environment: "Test",
            p_case_ids: [created.data!],
          });
          assert.equal(run.error, null);
          runId = run.data!;
          const changed = await member.client.rpc("save_case", {
            p_project_id: projectId!,
            p_case_id: created.data!,
            p_title: "Changed case",
            p_description: "",
            p_preconditions: "",
            p_priority: "low",
            p_classification: "automated",
            p_steps: [],
          });
          assert.equal(changed.error, null);
          const result = await member.client
            .from("run_cases")
            .select()
            .eq("run_id", runId)
            .single();
          assert.equal(result.error, null);
          resultId = result.data!.id;
          assert.equal(
            (result.data!.snapshot as { title: string }).title,
            "Original case",
          );
        },
      );
      await t.test(
        "completion and result edits serialize without an untested completed run",
        async () => {
          assert.equal(
            (
              await member.client.rpc("record_result", {
                p_run_case_id: resultId,
                p_status: "passed",
                p_notes: "",
              })
            ).error,
            null,
          );
          const results = await Promise.all([
            member.client.rpc("complete_run", { p_run_id: runId }),
            member.client.rpc("record_result", {
              p_run_case_id: resultId,
              p_status: "untested",
              p_notes: "",
            }),
          ]);
          assert.ok(results.some((r) => r.error));
          const current = await member.client
            .from("test_runs")
            .select("status,run_cases(status)")
            .eq("id", runId)
            .single();
          assert.equal(current.error, null);
          if (current.data!.status === "completed")
            assert.equal(current.data!.run_cases[0].status, "passed");
          else assert.equal(current.data!.run_cases[0].status, "untested");
        },
      );
      await t.test(
        "removed members lose access using an existing session",
        async () => {
          assert.equal(
            (
              await admin.client.rpc("manage_member", {
                p_user_id: member.id,
                p_role: "member",
                p_active: false,
              })
            ).error,
            null,
          );
          assert.equal(
            (await member.client.from("projects").select()).data?.length,
            0,
          );
          assert.ok(
            (
              await member.client.rpc("create_run", {
                p_project_id: projectId!,
                p_name: "Denied",
                p_environment: "",
                p_case_ids: [],
              })
            ).error,
          );
        },
      );
      await t.test(
        "concurrent admin demotions retain an active admin",
        async () => {
          // The fixture admins are the only admins in a fresh database. Skip if real admins exist.
          const count = await service
            .from("memberships")
            .select("user_id", { count: "exact", head: true })
            .eq("role", "admin")
            .eq("active", true);
          assert.equal(count.error, null);
          if (count.count !== 2) {
            t.diagnostic(
              "Other admins exist; last-admin concurrency is covered by transactional SQL tests.",
            );
            return;
          }
          const results = await Promise.all([
            admin.client.rpc("manage_member", {
              p_user_id: admin.id,
              p_role: "member",
              p_active: true,
            }),
            secondAdmin.client.rpc("manage_member", {
              p_user_id: secondAdmin.id,
              p_role: "member",
              p_active: true,
            }),
          ]);
          assert.equal(results.filter((r) => !r.error).length, 1);
          const remaining = await service
            .from("memberships")
            .select("user_id", { count: "exact", head: true })
            .eq("role", "admin")
            .eq("active", true);
          assert.equal(remaining.count, 1);
        },
      );
    } finally {
      await cleanup();
    }
  },
);

test("First-admin bootstrap and optional sample-data scripts work on an empty workspace", async (t) => {
  const admins = await service
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);
  assert.equal(admins.error, null);
  const existingDemo = await service
    .from("projects")
    .select("id")
    .eq("code", "DEMO")
    .maybeSingle();
  assert.equal(existingDemo.error, null);
  if (admins.count || existingDemo.data) {
    t.skip("Bootstrap smoke check requires no active admins or DEMO project.");
    return;
  }
  const email = `tcm-${prefix}-bootstrap@example.com`;
  emails.push(email);
  try {
    execFileSync("pnpm", ["bootstrap:admin"], {
      env: {
        ...process.env,
        BOOTSTRAP_ADMIN_EMAIL: email,
        BOOTSTRAP_ADMIN_NAME: "CLI Test Admin",
        BOOTSTRAP_ADMIN_PASSWORD: password,
      },
      stdio: "pipe",
    });
    const profile = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();
    assert.equal(profile.error, null);
    ids.push(profile.data!.id);
    const membership = await service
      .from("memberships")
      .select("role")
      .eq("user_id", profile.data!.id)
      .single();
    assert.equal(membership.data?.role, "admin");
    execFileSync("pnpm", ["seed:sample"], {
      env: {
        ...process.env,
        SEED_ADMIN_EMAIL: email,
        SEED_ADMIN_PASSWORD: password,
      },
      stdio: "pipe",
    });
    const demo = await service
      .from("projects")
      .select("id,test_cases(id),test_runs(id)")
      .eq("code", "DEMO")
      .single();
    assert.equal(demo.error, null);
    projectId = demo.data!.id;
    assert.equal(demo.data!.test_cases.length, 3);
    assert.equal(demo.data!.test_runs.length, 1);
  } finally {
    const profile = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profile.data && !ids.includes(profile.data.id))
      ids.push(profile.data.id);
    if (profile.data) {
      const demo = await service
        .from("projects")
        .select("id")
        .eq("code", "DEMO")
        .eq("created_by", profile.data.id)
        .maybeSingle();
      if (demo.data) projectId = demo.data.id;
    }
    await cleanup();
  }
});
