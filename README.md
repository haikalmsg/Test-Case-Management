# Test Case Management

A Next.js + Supabase starter for one QA team. Organize test cases into projects and flat suites, execute selected cases, record outcomes, and review your team's dashboard.

## Included

- Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS, shadcn-style UI primitives, and Lucide icons.
- Email/password login, password recovery, invitation acceptance, and admin/member roles.
- Projects and suites; case creation, editing, duplication, archiving, ordered steps, search, filters, and pagination.
- Runs with immutable case snapshots, result notes and tester timestamps, progress, and completion protection.
- Admin invitations, role/access management, workspace settings, and a last-admin safeguard.
- Typed Supabase clients, SQL migrations, row-level security, database/API tests, and optional Playwright workflows.

One shared workspace. Billing, organization switching, per-project permissions, attachments, reusable test plans, CSV exchange, AI, CI integrations, and a public REST API are outside v1.

## Local quick start

Requires Node.js 22+ (Node 24 recommended), pnpm, and a running Docker daemon. Supabase CLI is a project dependency; no global installation is needed.

```sh
pnpm install --frozen-lockfile
pnpm db:start
pnpm env:local
```

`db:start` applies migrations on the first start and runs Supabase locally. `env:local` writes the running instance's keys to the ignored `.env.local` without printing them. It refuses to overwrite an existing file; `pnpm env:local --force` explicitly replaces it with local settings.

Create the first admin. Use your own email and a password of at least eight characters. Read the password without echoing it or putting it in shell history:

```sh
# zsh (the default macOS shell)
read -s 'BOOTSTRAP_ADMIN_PASSWORD?Choose an admin password: '
export BOOTSTRAP_ADMIN_PASSWORD
pnpm bootstrap:admin
unset BOOTSTRAP_ADMIN_PASSWORD
pnpm dev
```

The script prompts for an email and name. Alternatively supply `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_NAME` through your environment. It refuses to run when an active admin already exists and does not commit or log passwords. Open [localhost:3000](http://localhost:3000) and sign in.

Local services:

| Service                                 | URL                    |
| --------------------------------------- | ---------------------- |
| Application                             | http://localhost:3000  |
| Supabase API                            | http://127.0.0.1:54321 |
| Supabase Studio                         | http://127.0.0.1:54323 |
| Mailpit, invitation and recovery emails | http://127.0.0.1:54324 |

Stop the backend with `pnpm db:stop`. Configuration changes in `supabase/config.toml` require stopping and restarting Supabase. Public registration is disabled using `auth.enable_signup=false`; keep `auth.email.enable_signup=true` so the email provider supports login and recovery.

To add optional sample data, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` for your admin and run `pnpm seed:sample`. The script creates a DEMO project, an Authentication suite, three cases, and a smoke run. It refuses to overwrite an existing DEMO project. Unset the password variable afterward.

## Hosted Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL`. The server key may be a service-role JWT or Supabase secret key; it must never have a `NEXT_PUBLIC_` prefix.
2. Apply both files in `supabase/migrations` in timestamp order using the SQL Editor. Alternatively use `pnpm exec supabase login`, `pnpm exec supabase link --project-ref YOUR_PROJECT_REF`, and `pnpm exec supabase db push`. Use a new project: these migrations create the complete schema.
3. In Auth settings, enable the Email provider, disable **Allow new users to sign up**, keep anonymous sign-ins disabled, and set the minimum password length to eight.
4. Set the Auth Site URL to your application's canonical origin, without a trailing slash. Allow exactly `YOUR_APP_ORIGIN/update-password?flow=invite` and `YOUR_APP_ORIGIN/update-password?flow=recovery` as redirect URLs. Add localhost equivalents only for development.
5. Copy `supabase/templates/invite.html` into the **Invite user** email template and `supabase/templates/recovery.html` into **Reset password**. These links send `token_hash` to `/auth/confirm`, which verifies the token on the server and writes the session cookies. The recovery template preserves invitation intent when an existing account is invited again.
6. Configure custom SMTP so invitations and recovery messages can reach your team. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
7. Run `pnpm bootstrap:admin` against that environment, then start or deploy the app. Invite additional users through **Team & settings**.

The admin app prepares a database invitation before sending email. Failed delivery leaves it pending so an admin can retry. Existing accounts receive a recovery link with invitation intent. A verified recipient sets a password and accepts their stored invitation; public signup and arbitrary role metadata cannot grant workspace access. Invitations may be accepted for seven days after preparation; email tokens have their own Supabase expiry. Revoking an invitation prevents acceptance, and removing membership immediately blocks database access with existing sessions.

## Development and validation

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm test:db
pnpm test:backend
```

Database checks use pgTAP against local Supabase and roll their fixtures back. Backend tests call Supabase Auth and PostgREST directly, including local Mailpit emails and concurrent mutations; they do not open a browser or test front-end rendering. They refuse to run against a remote project, remove only their fixture rows, and require Docker/local database access for cleanup. The cleanup transaction briefly locks the membership table while removing its own fixture admins.

SQL coverage includes anonymous/nonmember/removed-member access, direct role escalation, admin permissions, project consistency, atomic run creation, snapshot preservation, dashboard totals, immutable completed runs, invitation expiry/revocation, and last-admin protection. API checks cover login, disabled signup, invitation/password flows, session access removal, concurrent case numbering, competing run updates/completion, and concurrent admin demotion.

Playwright workflows are provided in `tests/e2e`. **Front-end/browser tests were not run, as requested.** To run them later, explicitly set `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for a local admin, then install Chromium with `pnpm exec playwright install chromium` and run `pnpm test:e2e`. They create an archived fixture project and an invited test member. Use a disposable local database. No browser binaries are installed automatically.

Additional commands:

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm db:migrate`   | Apply pending migrations to local Supabase  |
| `pnpm db:types`     | Regenerate and format local database types  |
| `pnpm db:reset`     | **Erase local data** and reapply migrations |
| `pnpm format`       | Format source and documentation             |
| `pnpm format:check` | Check formatting                            |

TypeScript 6 and ESLint 9 are pinned to versions supported by Next.js's current lint plugins. Newer major versions require checking that plugin compatibility before upgrading. Commit `pnpm-lock.yaml` with the source to keep installs reproducible.

## Architecture and behavior

- `src/app`: Server Component screens, route layouts, and the auth confirmation handler.
- `src/features`: feature queries, validated Server Actions, case editor, and run picker.
- `src/lib/supabase`: server/browser clients, a server-only invitation client, and generated database types.
- `supabase/migrations`: tables, constraints, RLS policies, and transactional RPCs.
- `scripts`: local environment setup, first-admin bootstrap, and optional sample data.

Every server read/mutation verifies authentication and current membership. The session proxy only refreshes cookies. Regular application queries use the user's Supabase client so RLS remains effective. Privileged keys are reserved for invitation delivery and explicit setup scripts. Authorization is based on database membership rather than user-controlled Auth metadata.

Members share all project repositories and runs. Admins additionally create/edit/archive projects and administer the team. Project codes are permanent, unique prefixes for project-scoped case numbers. Cases and suites may be archived; suite archiving leaves cases in the repository, and editing such a case requires selecting an active suite or no suite. Project archiving makes its repository and runs read-only.

Run creation snapshots every selected case and ordered steps in one database transaction. Up to 1,000 cases can be selected from a paginated, searchable picker; selections persist across search/page changes. Only RPCs can mutate cases, runs, or results. Completing a run requires every case to have a terminal result and serializes with result updates. Historical snapshots remain unchanged after case edits or archiving. Completed runs cannot be reopened in v1.

Progress is `(passed + failed + blocked + skipped) / total`. Pass rate is `passed / (passed + failed)` and displays “—” when there are no passed/failed outcomes. Dashboard results include current outcomes across all runs, including archived history; active case/project/run metrics exclude archived projects. Recorded timestamps are stored as `timestamptz` and displayed in UTC.

## Deployment

Deploy the Next.js app to Vercel or another Node.js host and use hosted Supabase. Set the four environment variables from `.env.example` on the host, set `NEXT_PUBLIC_APP_URL` to the deployed origin, and update Supabase Site URL, redirect allowlist, email templates, and SMTP. Apply migrations before deploying code that depends on them. Only the public URL/key and app origin may reach browser bundles; keep the server key private.

Use `pnpm build` and `pnpm start` for a production server. A deployment with multiple Next.js instances also needs a shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` per the [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting). This starter does not provision or deploy external services.
