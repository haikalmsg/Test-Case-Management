import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
test.beforeEach(async ({ page }) => {
  test.skip(
    !email || !password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a local admin.",
  );
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("E2E tests only run against local Supabase.");
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
});
test("library → plan → execution → rerun → completed history → dashboard", async ({
  page,
}) => {
  const code = `E${randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase()}`;
  const name = `E2E ${code}`;
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page.getByLabel("Project code", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name, exact: true }).click();
  await page.getByRole("link", { name: "Case library", exact: true }).click();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("Authentication");
  await page
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Case library folders", exact: true })
    .getByRole("link", { name: "Authentication", exact: true })
    .click();
  await page.getByRole("link", { name: "New case", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Valid sign-in");
  await page
    .getByLabel("Case group", { exact: true })
    .selectOption({ label: "Authentication" });
  await page.getByRole("button", { name: "Add step" }).click();
  await page
    .getByLabel("Action", { exact: true })
    .fill("Enter valid credentials");
  await page
    .getByLabel("Expected result", { exact: true })
    .fill("Dashboard appears");
  await page.getByRole("button", { name: "Create test case" }).click();
  await expect(
    page.getByRole("heading", { name: "Valid sign-in", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Test plans", exact: true }).click();
  await page.getByRole("link", { name: "New plan", exact: true }).click();
  await page.getByLabel("Plan name", { exact: true }).fill(`Plan ${code}`);
  await page
    .getByLabel("Filter by case group", { exact: true })
    .selectOption({ label: "Authentication" });
  await page
    .getByRole("button", { name: "Import whole group", exact: true })
    .click();
  await expect(
    page.getByLabel("Remove Valid sign-in", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await page
    .getByRole("link", { name: "Run all", exact: true })
    .first()
    .click();
  await page.getByLabel("Run name", { exact: true }).fill(`Smoke ${code}`);
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.getByLabel("Result", { exact: true }).selectOption("failed");
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await expect(page.getByText("1 of 1 cases executed")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete run", exact: true }).click();
  await expect(page.getByText(/This run is read-only/)).toBeVisible();
  await page
    .getByRole("link", { name: "Rerun failed/blocked", exact: true })
    .click();
  await page.getByLabel("Run name", { exact: true }).fill(`Retry ${code}`);
  await page.getByRole("button", { name: "Start rerun", exact: true }).click();
  await expect(page.getByLabel("Result", { exact: true })).toHaveValue(
    "untested",
  );
  await page.getByLabel("Result", { exact: true }).selectOption("passed");
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Complete run", exact: true }).click();
  await page
    .getByRole("link", { name: "View source execution", exact: true })
    .click();
  await expect(page.getByText(/This run is read-only/)).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `Smoke ${code}`, exact: true }),
  ).toBeVisible();
  // Preserve test history while removing this project from active work.
  await page.getByRole("link", { name: `Smoke ${code}`, exact: true }).click();
  await page.getByText("Project settings", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await expect(page.getByText(/This project is archived/)).toBeVisible();
});
test("admin invitation → password setup → member sign-in", async ({
  page,
  request,
  browser,
}) => {
  const invited = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  const memberPassword = `E2e-${randomUUID()}!`;
  await page
    .getByRole("link", { name: "Team & settings", exact: true })
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(invited);
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByText("Invitation email sent.", { exact: false }),
  ).toBeVisible();
  let link = "";
  await expect
    .poll(async () => {
      const inbox = await (
        await request.get("http://127.0.0.1:54324/api/v1/messages")
      ).json();
      const message = inbox.messages?.find((m: { To: { Address: string }[] }) =>
        m.To.some((to) => to.Address === invited),
      );
      if (!message) return false;
      const body = await (
        await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)
      ).json();
      const found = body.HTML.match(/https?:[^"\s<>]+token_hash[^"\s<>]+/);
      link = found?.[0]?.replaceAll("&amp;", "&") || "";
      return Boolean(link);
    })
    .toBe(true);
  const context = await browser.newContext();
  const memberPage = await context.newPage();
  await memberPage.goto(link);
  await memberPage
    .getByLabel("New password", { exact: true })
    .fill(memberPassword);
  await memberPage
    .getByLabel("Confirm password", { exact: true })
    .fill(memberPassword);
  await memberPage.getByRole("button", { name: "Set password & join" }).click();
  await expect(memberPage).toHaveURL(/dashboard/);
  await expect(
    memberPage.getByRole("link", { name: "Team & settings" }),
  ).toHaveCount(0);
  await memberPage.getByRole("button", { name: "Sign out" }).click();
  await memberPage.getByLabel("Email address", { exact: true }).fill(invited);
  await memberPage.getByLabel("Password", { exact: true }).fill(memberPassword);
  await memberPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(memberPage).toHaveURL(/dashboard/);
  await context.close();
});
