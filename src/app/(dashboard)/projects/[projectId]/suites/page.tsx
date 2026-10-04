import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { saveSuite, archiveSuite } from "@/features/repository/actions";
import { ActionForm, Field } from "@/components/forms";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
export default async function Suites({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  const { client } = await requireMember();
  const { data, error } = await client
    .from("suites")
    .select("*")
    .eq("project_id", projectId)
    .order("name");
  assertOk(error);
  return (
    <>
      <PageHeader
        eyebrow={`${project.code} / Repository`}
        title="Test suites"
        description="Group related cases into focused areas of coverage."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {data?.length ? (
            data.map((s) => (
              <Card key={s.id}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{s.name}</h2>
                    {s.archived_at ? <Badge>Archived</Badge> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {s.description || "No description."}
                  </p>
                  {!project.archived_at && !s.archived_at ? (
                    <details className="mt-5">
                      <summary className="cursor-pointer text-xs font-medium text-primary">
                        Edit suite
                      </summary>
                      <div className="mt-4 space-y-4">
                        <ActionForm action={saveSuite} submit="Save suite">
                          <input
                            name="project_id"
                            type="hidden"
                            value={projectId}
                          />
                          <input name="id" type="hidden" value={s.id} />
                          <Field label="Suite name" htmlFor={`name-${s.id}`}>
                            <Input
                              id={`name-${s.id}`}
                              name="name"
                              defaultValue={s.name}
                              maxLength={120}
                              required
                            />
                          </Field>
                          <Field
                            label="Description"
                            htmlFor={`description-${s.id}`}
                          >
                            <Textarea
                              id={`description-${s.id}`}
                              name="description"
                              defaultValue={s.description}
                              maxLength={10000}
                            />
                          </Field>
                        </ActionForm>
                        <ActionForm
                          action={archiveSuite}
                          submit="Archive suite"
                          variant="destructive"
                          confirm="Archive this suite? Its cases remain in the repository."
                        >
                          <input name="id" type="hidden" value={s.id} />
                        </ActionForm>
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                title="Keep related tests together"
                description="Create a suite for an area such as authentication, checkout, or permissions."
              />
            </Card>
          )}
        </div>
        {!project.archived_at ? (
          <Card>
            <CardHeader>
              <CardTitle>New suite</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveSuite} submit="Create suite">
                <input name="project_id" type="hidden" value={projectId} />
                <Field label="Suite name" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Authentication"
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    name="description"
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
