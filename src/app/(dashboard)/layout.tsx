import { requireMember } from "@/lib/auth";
import { logout } from "@/features/auth/actions";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { assertOk } from "@/lib/actions";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, user, member } = await requireMember();
  const [projects, settings, profile] = await Promise.all([
    client
      .from("projects")
      .select("id,name,code")
      .is("archived_at", null)
      .order("name"),
    client.from("workspace_settings").select("name").single(),
    client
      .from("profiles")
      .select("full_name,email")
      .eq("id", user.id)
      .single(),
  ]);
  [projects, settings, profile].forEach((r) => assertOk(r.error));
  const name = profile.data?.full_name || user.email || "Team member";
  return (
    <>
      <Sidebar
        projects={projects.data ?? []}
        admin={member.role === "admin"}
        workspace={settings.data?.name ?? "Workspace"}
      />
      <div className="lg:pl-60">
        <header className="flex h-18 items-center justify-between border-b border-border bg-white px-6 lg:px-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Team workspace
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-primary">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="max-w-48 truncate text-xs font-medium">{name}</p>
              <p className="text-[10px] capitalize text-muted-foreground">
                {member.role}
              </p>
            </div>
            <form action={logout}>
              <Button
                size="icon"
                variant="ghost"
                type="submit"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </>
  );
}
