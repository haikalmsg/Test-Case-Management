import Link from "next/link";
import { ActionForm, Field } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { login } from "@/features/auth/actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        Your quality workspace
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">
        Sign in to pick up where your team left off.
      </p>
      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-700">
          The link is invalid or expired. Ask your admin for a new invitation or
          request a password reset.
        </p>
      ) : null}
      <ActionForm action={login} submit="Sign in">
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
      </ActionForm>
      <Link
        href="/forgot-password"
        className="mt-5 inline-block text-sm text-primary"
      >
        Forgot your password?
      </Link>
      <p className="mt-10 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
        Access is by invitation. Contact your workspace admin to join the team.
      </p>
    </>
  );
}
