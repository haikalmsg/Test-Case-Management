import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { isConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
export default function Setup() {
  if (isConfigured()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <div className="mb-8 flex items-center gap-3">
        <CheckCheck className="size-8 text-primary" />
        <h1 className="text-2xl font-semibold">Test Case Management</h1>
      </div>
      <Card>
        <CardContent className="space-y-5 p-8">
          <h2 className="text-xl font-semibold">Connect your workspace</h2>
          <p className="text-sm text-muted-foreground">
            The app is ready for a Supabase connection. Follow the README to
            finish setup.
          </p>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code> and add
              your Supabase keys.
            </li>
            <li>
              Apply the database migration and configure invitation and recovery
              email templates.
            </li>
            <li>Run the first-admin bootstrap script.</li>
            <li>Restart the app and sign in.</li>
          </ol>
          <Link href="/login" className="text-sm text-primary">
            Continue to sign in →
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
