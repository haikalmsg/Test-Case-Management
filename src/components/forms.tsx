"use client";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { Button } from "./ui/button";
export function SubmitButton({
  children = "Save",
  variant = "default",
  disabled = false,
}: {
  children?: ReactNode;
  variant?: "default" | "outline" | "destructive" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} variant={variant}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {pending ? "Saving…" : children}
    </Button>
  );
}
export function ActionForm({
  action,
  children,
  submit = "Save",
  className = "space-y-4",
  variant = "default",
  confirm,
  submitDisabled = false,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submit?: string;
  className?: string;
  variant?: "default" | "outline" | "destructive" | "ghost";
  confirm?: string;
  submitDisabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
    >
      {children}
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {state.success}
        </p>
      ) : null}
      <SubmitButton variant={variant} disabled={submitDisabled}>
        {submit}
      </SubmitButton>
    </form>
  );
}
export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
