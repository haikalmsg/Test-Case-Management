import { requireUser } from "@/lib/auth";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default async function AccessDenied() {
  await requireUser();
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">Workspace access required</h1>
      <p className="my-5 text-sm text-muted-foreground">
        Your account does not have active team access. Ask your admin for an
        invitation or to restore your membership.
      </p>
      <Button asChild variant="outline">
        <Link href="/update-password?flow=invite">
          Finish accepting an invitation
        </Link>
      </Button>
      <form action={logout} className="mt-4">
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </main>
  );
}
