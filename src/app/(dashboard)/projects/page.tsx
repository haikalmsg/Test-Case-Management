import Link from "next/link";
import { FolderKanban, ArrowUpRight, Plus } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { saveProject } from "@/features/projects/actions";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { ActionForm, Field } from "@/components/forms";
export default async function Projects() {
  const { client, member } = await requireMember();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  assertOk(error);
  const active = data?.filter((p) => !p.archived_at) ?? [];
  const archived = data?.filter((p) => p.archived_at) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Keep your testing organized, one project at a time."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((p, i) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}/plans`}
                className="group"
              >
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div
                        className={`flex size-11 items-center justify-center rounded-xl ${i % 2 ? "bg-teal-50 text-teal-600" : "bg-indigo-50 text-primary"}`}
                      >
                        <FolderKanban className="size-5" />
                      </div>
                      <Badge>{p.code}</Badge>
                    </div>
                    <h2 className="text-lg font-semibold group-hover:text-primary">
                      {p.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {p.description || "Your next great release starts here."}
                    </p>
                    <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                      <span>Open test plans</span>
                      <ArrowUpRight className="size-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {!active.length ? (
            <Card>
              <EmptyState
                title="Your first project starts here"
                description="Create a project to organize test plans, library cases, and executions."
              />
            </Card>
          ) : null}
          {archived.length ? (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Archived projects ({archived.length})
              </summary>
              <div className="mt-4 space-y-2">
                {archived.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/plans`}
                    className="block rounded-lg border bg-white p-4 text-sm"
                  >
                    {p.name} <Badge className="ml-2">Archived</Badge>
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </div>
        {member.role === "admin" ? (
          <Card id="new">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                New project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveProject} submit="Create project">
                <Field label="Project name" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Customer Portal"
                    maxLength={120}
                    required
                  />
                </Field>
                <Field
                  label="Project code"
                  htmlFor="code"
                  hint="A permanent prefix for case IDs, e.g. PORTAL-12."
                >
                  <Input
                    id="code"
                    name="code"
                    placeholder="PORTAL"
                    pattern="[A-Za-z][A-Za-z0-9]{1,9}"
                    maxLength={10}
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="What are we testing?"
                    maxLength={10000}
                  />
                </Field>
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
