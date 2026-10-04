import { getProject } from "@/features/projects/queries";
import { requireMember } from "@/lib/auth";
import { saveProject, archiveProject } from "@/features/projects/actions";
import { ActionForm, Field } from "@/components/forms";
import { Input, Textarea } from "@/components/ui/input";
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  const { member } = await requireMember();
  return (
    <>
      {project.archived_at ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          This project is archived. Its repository and run history are
          read-only.
        </p>
      ) : null}
      {children}
      {member.role === "admin" && !project.archived_at ? (
        <details className="mt-10 rounded-xl border bg-white p-5">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Project settings
          </summary>
          <div className="mt-5 grid max-w-3xl gap-8 md:grid-cols-2">
            <ActionForm action={saveProject} submit="Update project">
              <input name="id" value={project.id} type="hidden" />
              <input name="code" value={project.code} type="hidden" />
              <Field label="Project name" htmlFor="project-name">
                <Input
                  id="project-name"
                  name="name"
                  defaultValue={project.name}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Description" htmlFor="project-description">
                <Textarea
                  id="project-description"
                  name="description"
                  defaultValue={project.description}
                  maxLength={10000}
                />
              </Field>
            </ActionForm>
            <div>
              <h2 className="mb-2 text-sm font-medium">Archive project</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Remove this project from active work and preserve its test
                history. Active runs will become read-only.
              </p>
              <ActionForm
                action={archiveProject}
                submit="Archive project"
                variant="destructive"
                confirm="Archive this project? Active runs will become read-only."
              >
                <input name="id" value={project.id} type="hidden" />
              </ActionForm>
            </div>
          </div>
        </details>
      ) : null}
    </>
  );
}
