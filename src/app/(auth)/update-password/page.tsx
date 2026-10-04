import { requireUser } from "@/lib/auth";
import { ActionForm, Field } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/features/auth/actions";
export default async function UpdatePassword({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  await requireUser();
  const { flow } = await searchParams;
  const invite = flow === "invite";
  return (
    <>
      <h1 className="text-3xl font-semibold">
        {invite ? "Join your team" : "Choose a new password"}
      </h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">
        {invite
          ? "Set a password to finish accepting your invitation."
          : "Use at least 8 characters for your new password."}
      </p>
      <ActionForm
        action={updatePassword}
        submit={invite ? "Set password & join" : "Update password"}
      >
        <input
          type="hidden"
          name="flow"
          value={invite ? "invite" : "recovery"}
        />
        <Field label="New password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmation">
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
      </ActionForm>
    </>
  );
}
