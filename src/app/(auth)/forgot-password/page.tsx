import Link from "next/link";
import { ActionForm, Field } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { requestReset } from "@/features/auth/actions";
export default function ForgotPassword() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">
        We’ll email a link to help you get back in.
      </p>
      <ActionForm action={requestReset} submit="Send reset link">
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
      </ActionForm>
      <Link href="/login" className="mt-6 inline-block text-sm text-primary">
        ← Back to sign in
      </Link>
    </>
  );
}
