import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import {
  createClient,
  type PostgrestSingleResponse,
} from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import type { Database, Json } from "../../src/lib/supabase/database.types";
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
      // Delete children before source executions because reruns reference runs.
      await pg.query(
        "delete from public.test_runs where project_id=$1 and source_run_id is not null",
        [projectId],
      );
      await pg.query("delete from public.test_runs where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.plan_cases where project_id=$1", [
        projectId,
      ]);
      await pg.query("delete from public.test_plans where project_id=$1", [
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
      let planId: string;
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
          const plan = await member.client.rpc("save_plan", {
            p_project_id: projectId!,
            p_name: "Snapshot plan",
            p_description: "",
            p_case_ids: [created.data!],
          });
          assert.equal(plan.error, null);
          planId = plan.data!;
          const run = await member.client.rpc("create_plan_run", {
            p_plan_id: planId,
            p_name: "Concurrent execution",
            p_environment: "Test",
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
        "nested folder imports across pages, shared cases, and reruns preserve execution history",
        async () => {
          const root = await member.client.rpc("save_group", {
            p_project_id: projectId!,
            p_name: "API case group",
            p_description: "",
          });
          assert.equal(root.error, null);
          const group = await member.client
            .from("suites")
            .select()
            .eq("id", root.data!)
            .single();
          assert.equal(group.error, null);
          const child = await member.client.rpc("save_group", {
            p_project_id: projectId!,
            p_name: "Child folder",
            p_description: "",
            p_parent_id: root.data!,
          });
          assert.equal(child.error, null);
          const grandchild = await member.client.rpc("save_group", {
            p_project_id: projectId!,
            p_name: "Grandchild folder",
            p_description: "",
            p_parent_id: child.data!,
          });
          assert.equal(grandchild.error, null);
          const descendants = await member.client.rpc("group_descendant_ids", {
            p_project_id: projectId!,
            p_group_id: root.data!,
          });
          assert.equal(descendants.error, null);
          assert.deepEqual(
            new Set(descendants.data!),
            new Set([root.data!, child.data!, grandchild.data!]),
          );
          const fixture = await service
            .from("test_cases")
            .insert(
              Array.from({ length: 105 }, (_, i) => ({
                project_id: projectId!,
                suite_id: descendants.data![i % 3],
                title: `Library case ${i}`,
                number: 0,
                created_by: member.id,
              })),
            )
            .select("id,number")
            .order("number");
          assert.equal(fixture.error, null);
          const library = () =>
            member.client
              .from("test_cases")
              .select("id,number", { count: "exact" })
              .eq("project_id", projectId!)
              .in("suite_id", descendants.data!)
              .is("archived_at", null)
              .order("number");
          const pages = await Promise.all([
            library().range(0, 99),
            library().range(100, 199),
          ]);
          pages.forEach((p) => assert.equal(p.error, null));
          assert.equal(pages[0].count, 105);
          assert.equal(pages[0].data!.length, 100);
          assert.equal(pages[1].data!.length, 5);
          const imported = pages.flatMap((p) => p.data!.map((c) => c.id));
          const planValues = {
            p_project_id: projectId!,
            p_name: "Reusable group plan",
            p_description: "",
            p_case_ids: imported,
          };
          const plan = await member.client.rpc("save_plan", planValues);
          assert.equal(plan.error, null);
          const shared = await member.client.rpc("save_plan", {
            ...planValues,
            p_name: "Second plan",
            p_case_ids: [imported[0]],
          });
          assert.equal(shared.error, null);
          const references = await member.client
            .from("plan_cases")
            .select()
            .eq("case_id", imported[0]);
          assert.equal(references.error, null);
          assert.equal(references.data!.length, 2);
          const added = await member.client.rpc("save_case", {
            p_project_id: projectId!,
            p_suite_id: group.data!.id,
            p_title: "Added after group import",
            p_description: "",
            p_preconditions: "",
            p_priority: "medium",
            p_classification: "manual",
            p_steps: [],
          });
          assert.equal(added.error, null);
          const run = await member.client.rpc("create_plan_run", {
            p_plan_id: plan.data!,
            p_name: "Group execution",
            p_environment: "API",
          });
          assert.equal(run.error, null);
          const outcomes = await member.client
            .from("run_cases")
            .select()
            .eq("run_id", run.data!)
            .order("case_number");
          assert.equal(outcomes.error, null);
          assert.equal(outcomes.data!.length, 105);
          assert.ok(!outcomes.data!.some((c) => c.case_id === added.data));
          for (let i = 0; i < outcomes.data!.length; i += 20) {
            const results = await Promise.all(
              outcomes.data!.slice(i, i + 20).map((c, j) =>
                member.client.rpc("record_result", {
                  p_run_case_id: c.id,
                  p_status:
                    (
                      [
                        "failed",
                        "blocked",
                        "failed",
                        "blocked",
                        "skipped",
                      ] as const
                    )[i + j] ?? "passed",
                  p_notes: "Original execution notes",
                }),
              ),
            );
            results.forEach((r) => assert.equal(r.error, null));
          }
          assert.equal(
            (await member.client.rpc("complete_run", { p_run_id: run.data! }))
              .error,
            null,
          );
          const before = await member.client
            .from("test_runs")
            .select("*,run_cases(*)")
            .eq("id", run.data!)
            .single();
          assert.equal(before.error, null);
          const updated = await member.client.rpc("save_case", {
            p_project_id: projectId!,
            p_case_id: imported[0],
            p_suite_id: group.data!.id,
            p_title: "Latest case title",
            p_description: "Latest description",
            p_preconditions: "Latest precondition",
            p_priority: "high",
            p_classification: "automated",
            p_steps: [
              { action: "Latest action", expected_result: "Latest expected" },
            ],
          });
          assert.equal(updated.error, null);
          assert.equal(
            (
              await member.client.rpc("archive_case", {
                p_case_id: imported[2],
              })
            ).error,
            null,
          );
          const currentIds = imported.filter((id) => id !== imported[3]);
          currentIds.push(added.data!);
          assert.equal(
            (
              await member.client.rpc("save_plan", {
                ...planValues,
                p_plan_id: plan.data!,
                p_case_ids: currentIds,
              })
            ).error,
            null,
          );
          const retryValues = {
            p_plan_id: plan.data!,
            p_source_run_id: run.data!,
            p_name: "Targeted retry",
            p_environment: "API",
            p_mode: "unsuccessful",
          };
          const retry = await member.client.rpc("create_plan_run", retryValues);
          assert.equal(retry.error, null);
          const retryCases = await member.client
            .from("run_cases")
            .select()
            .eq("run_id", retry.data!)
            .order("case_number");
          assert.equal(retryCases.error, null);
          assert.deepEqual(
            retryCases.data!.map((c) => c.case_id),
            imported.slice(0, 2),
          );
          assert.ok(
            retryCases.data!.every(
              (c) =>
                c.status === "untested" &&
                c.notes === "" &&
                c.tested_at === null &&
                c.tester_id === null,
            ),
          );
          const snapshot = retryCases.data![0].snapshot as {
            title: string;
            steps: { action: string }[];
          };
          assert.equal(snapshot.title, "Latest case title");
          assert.equal(snapshot.steps[0].action, "Latest action");
          const full = await member.client.rpc("create_plan_run", {
            ...retryValues,
            p_mode: "all",
            p_name: "Full retry",
          });
          assert.equal(full.error, null);
          const fullCases = await member.client
            .from("run_cases")
            .select("case_id")
            .eq("run_id", full.data!);
          assert.equal(fullCases.error, null);
          assert.equal(fullCases.data!.length, 104);
          assert.ok(fullCases.data!.some((c) => c.case_id === added.data));
          const after = await member.client
            .from("test_runs")
            .select("*,run_cases(*)")
            .eq("id", run.data!)
            .single();
          assert.equal(after.error, null);
          // Nested row order is not part of the API contract.
          before.data!.run_cases.sort((a, b) => a.id.localeCompare(b.id));
          after.data!.run_cases.sort((a, b) => a.id.localeCompare(b.id));
          assert.deepEqual(after.data, before.data);
          const removed = await member.client
            .from("test_cases")
            .select("id")
            .eq("id", imported[3])
            .single();
          assert.equal(removed.error, null);
          assert.equal(
            (
              await member.client.rpc("save_plan", {
                ...planValues,
                p_plan_id: plan.data!,
                p_case_ids: [added.data!],
              })
            ).error,
            null,
          );
          const emptyRetry = await member.client.rpc(
            "create_plan_run",
            retryValues,
          );
          assert.match(emptyRetry.error!.message, /No eligible cases/);
          assert.equal(
            (await member.client.rpc("archive_plan", { p_plan_id: plan.data! }))
              .error,
            null,
          );
          assert.ok(
            (
              await member.client.rpc("create_plan_run", {
                ...retryValues,
                p_mode: "all",
              })
            ).error,
          );
          for (const c of retryCases.data!)
            assert.equal(
              (
                await member.client.rpc("record_result", {
                  p_run_case_id: c.id,
                  p_status: "passed",
                  p_notes: "Fixed",
                })
              ).error,
              null,
            );
          assert.equal(
            (await member.client.rpc("complete_run", { p_run_id: retry.data! }))
              .error,
            null,
          );
        },
      );
      await t.test(
        "concurrent plan saves and starts capture one complete membership",
        async () => {
          const cases = await member.client
            .from("test_cases")
            .select("id")
            .eq("project_id", projectId!)
            .is("archived_at", null)
            .order("number")
            .limit(2);
          assert.equal(cases.error, null);
          const ids = cases.data!.map((c) => c.id);
          const values = {
            p_project_id: projectId!,
            p_name: "Concurrent plan",
            p_description: "",
            p_case_ids: [ids[0]],
          };
          const plan = await member.client.rpc("save_plan", values);
          assert.equal(plan.error, null);
          for (let i = 0; i < 4; i++) {
            assert.equal(
              (
                await member.client.rpc("save_plan", {
                  ...values,
                  p_plan_id: plan.data!,
                })
              ).error,
              null,
            );
            const [saved, started]: [
              PostgrestSingleResponse<string>,
              PostgrestSingleResponse<string>,
            ] = await Promise.all([
              member.client.rpc("save_plan", {
                ...values,
                p_plan_id: plan.data!,
                p_case_ids: ids,
              }),
              member.client.rpc("create_plan_run", {
                p_plan_id: plan.data!,
                p_name: `Race ${i}`,
                p_environment: "",
              }),
            ]);
            assert.equal(saved.error, null);
            assert.equal(started.error, null);
            const snapshot: PostgrestSingleResponse<{ case_id: string }[]> =
              await member.client
                .from("run_cases")
                .select("case_id")
                .eq("run_id", started.data!)
                .order("case_number");
            assert.equal(snapshot.error, null);
            assert.ok(
              snapshot.data!.length === 1 || snapshot.data!.length === 2,
            );
            assert.deepEqual(
              snapshot.data!.map((c) => c.case_id),
              ids.slice(0, snapshot.data!.length),
            );
          }
          // A concurrent library edit cannot mix a title from one version with steps from another.
          const caseValues = {
            p_project_id: projectId!,
            p_case_id: ids[0],
            p_priority: "medium" as const,
            p_classification: "manual" as const,
            p_preconditions: "",
          };
          for (let i = 0; i < 4; i++) {
            const version = `Version ${i}`;
            const [saved, started]: [
              PostgrestSingleResponse<string>,
              PostgrestSingleResponse<string>,
            ] = await Promise.all([
              member.client.rpc("save_case", {
                ...caseValues,
                p_title: version,
                p_description: version,
                p_steps: [{ action: version, expected_result: version }],
              }),
              member.client.rpc("create_plan_run", {
                p_plan_id: plan.data!,
                p_name: version,
                p_environment: "",
              }),
            ]);
            assert.equal(saved.error, null);
            assert.equal(started.error, null);
            const result: PostgrestSingleResponse<{ snapshot: Json }> =
              await member.client
                .from("run_cases")
                .select("snapshot")
                .eq("run_id", started.data!)
                .eq("case_id", ids[0])
                .single();
            assert.equal(result.error, null);
            const content = result.data!.snapshot as {
              title: string;
              description: string;
              steps: { action: string }[];
            };
            if (content.title.startsWith("Version")) {
              assert.equal(content.description, content.title);
              assert.equal(content.steps[0].action, content.title);
            } else assert.equal(i, 0);
          }
        },
      );
      await t.test(
        "competing folder moves cannot create a hierarchy cycle",
        async () => {
          const values = { p_project_id: projectId!, p_description: "" };
          const a = await member.client.rpc("save_group", {
            ...values,
            p_name: "Folder A",
          });
          const b = await member.client.rpc("save_group", {
            ...values,
            p_name: "Folder B",
          });
          assert.equal(a.error, null);
          assert.equal(b.error, null);
          const moves = await Promise.all([
            member.client.rpc("save_group", {
              ...values,
              p_group_id: a.data!,
              p_name: "Folder A",
              p_parent_id: b.data!,
            }),
            member.client.rpc("save_group", {
              ...values,
              p_group_id: b.data!,
              p_name: "Folder B",
              p_parent_id: a.data!,
            }),
          ]);
          assert.equal(moves.filter((result) => !result.error).length, 1);
          assert.match(
            moves.find((result) => result.error)!.error!.message,
            /itself|subgroups/,
          );
          const tree = await member.client.rpc("group_descendant_ids", {
            p_project_id: projectId!,
            p_group_id: moves[0].error ? a.data! : b.data!,
          });
          assert.equal(tree.error, null);
          assert.deepEqual(new Set(tree.data!), new Set([a.data!, b.data!]));
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
              await member.client.rpc("create_plan_run", {
                p_plan_id: planId,
                p_name: "Denied",
                p_environment: "",
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
              "Other admins exist; skipping the last-admin demotion scenario.",
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
      .select("id,test_cases(id),test_plans(id),test_runs(id,plan_id)")
      .eq("code", "DEMO")
      .single();
    assert.equal(demo.error, null);
    projectId = demo.data!.id;
    assert.equal(demo.data!.test_cases.length, 3);
    assert.equal(demo.data!.test_runs.length, 1);
    assert.equal(demo.data!.test_plans.length, 1);
    assert.equal(demo.data!.test_runs[0].plan_id, demo.data!.test_plans[0].id);
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
