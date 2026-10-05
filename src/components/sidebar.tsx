"use client";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  CheckCheck,
  LayoutDashboard,
  FolderKanban,
  Users,
  BookOpen,
  ClipboardList,
  Play,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "./ui/input";
export function Sidebar({
  projects,
  admin,
  workspace,
}: {
  projects: { id: string; name: string; code: string }[];
  admin: boolean;
  workspace: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const projectId =
    typeof params.projectId === "string" ? params.projectId : "";
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    ...(admin
      ? [{ href: "/team", label: "Team & settings", icon: Users }]
      : []),
  ];
  const projectLinks = [
    { suffix: "plans", label: "Test plans", icon: ClipboardList },
    { suffix: "cases", label: "Case library", icon: BookOpen },
    { suffix: "runs", label: "Run history", icon: Play },
  ];
  return (
    <aside className="border-b border-border bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
          <CheckCheck className="size-5" />
        </div>
        <div>
          <span className="block text-sm font-bold tracking-tight">
            Test Case
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Management
          </span>
        </div>
      </Link>
      <div className="px-4 pb-3">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <nav
          aria-label="Workspace navigation"
          className="flex flex-wrap gap-1 lg:flex-col"
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                pathname === href
                  ? "bg-primary/8 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t pt-5">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Project
          </p>
          <Select
            aria-label="Select project"
            value={projectId}
            onChange={(e) =>
              router.push(
                e.target.value
                  ? `/projects/${e.target.value}/plans`
                  : "/projects",
              )
            }
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {projectId ? (
            <nav
              aria-label="Project navigation"
              className="mt-3 flex flex-wrap gap-1 lg:flex-col"
            >
              {projectLinks.map(({ suffix, label, icon: Icon }) => {
                const href = `/projects/${projectId}/${suffix}`;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      pathname.startsWith(href)
                        ? "bg-primary/8 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </div>
      <div className="hidden lg:absolute lg:inset-x-4 lg:bottom-5 lg:block">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="truncate text-xs font-semibold">{workspace}</p>
          <p className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            One team. Shared quality.
            <ChevronRight className="size-3" />
          </p>
        </div>
      </div>
    </aside>
  );
}
