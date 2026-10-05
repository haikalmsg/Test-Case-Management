import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";
import { getProject } from "@/features/projects/queries";
import { getCase } from "@/features/repository/queries";
import { archiveCase, duplicateCase } from "@/features/repository/actions";
import { PageHeader, StatusBadge } from "@/components/shared";
import { ActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
export default async function CaseDetail({
  params,
}: {
  params: Promise<{ projectId: string; caseId: string }>;
}) {
  const { projectId, caseId } = await params;
  const project = await getProject(projectId);
  const item = await getCase(projectId, caseId);
  const editable = !project.archived_at && !item.archived_at;
  return (
    <>
      <Link
        href={`/projects/${projectId}/cases${item.suite_id ? `?suite=${item.suite_id}` : ""}`}
        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3" />
        Back to folder
      </Link>
      <PageHeader eyebrow={`${project.code}-${item.number}`} title={item.title}>
        {editable ? (
          <Button asChild>
            <Link href={`/projects/${projectId}/cases/${caseId}/edit`}>
              <Pencil className="size-4" />
              Edit case
            </Link>
          </Button>
        ) : (
          <Badge>Archived</Badge>
        )}
      </PageHeader>
      <div className="mb-6 flex gap-2">
        <StatusBadge status={item.priority} />
        <Badge>{item.classification}</Badge>
        <Badge>{item.suites?.name ?? "Ungrouped"}</Badge>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-6">
              <div>
                <h2 className="mb-2 text-sm font-semibold">Description</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {item.description || "No description provided."}
                </p>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold">Preconditions</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {item.preconditions || "No preconditions specified."}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Test steps</CardTitle>
              <Badge>{item.case_steps.length} steps</Badge>
            </CardHeader>
            {item.case_steps.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ACTION</th>
                      <th>EXPECTED RESULT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.case_steps.map((s, i) => (
                      <tr key={s.id}>
                        <td className="w-12 text-muted-foreground">{i + 1}</td>
                        <td className="w-1/2 whitespace-pre-wrap align-top">
                          {s.action}
                        </td>
                        <td className="whitespace-pre-wrap align-top text-muted-foreground">
                          {s.expected_result}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No steps defined.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
        {editable ? (
          <Card>
            <CardHeader>
              <CardTitle>Case actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Use this case as a starting point for another scenario.
                </p>
                <ActionForm
                  action={duplicateCase}
                  submit="Duplicate case"
                  variant="outline"
                >
                  <input type="hidden" name="id" value={caseId} />
                </ActionForm>
              </div>
              <div className="border-t pt-5">
                <p className="mb-3 text-xs text-muted-foreground">
                  Archiving hides this case from active work and keeps run
                  history intact.
                </p>
                <ActionForm
                  action={archiveCase}
                  submit="Archive case"
                  variant="destructive"
                  confirm="Archive this test case?"
                >
                  <input type="hidden" name="id" value={caseId} />
                </ActionForm>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
