"use client";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { FolderPlus, Pencil, Archive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ActionForm, Field } from "@/components/forms";
import { saveSuite, archiveSuite } from "./actions";
import { groupDescendants, groupOptions, type CaseGroup } from "./groups";
import type { ActionState } from "@/lib/actions";

function FolderDialog({
  projectId,
  groups,
  current,
  kind,
}: {
  projectId: string;
  groups: CaseGroup[];
  current?: CaseGroup;
  kind: "create" | "edit" | "archive";
}) {
  const [open, setOpen] = useState(false);
  const excluded =
    kind === "edit" && current
      ? new Set(groupDescendants(groups, current.id))
      : new Set<string>();
  const parents = groupOptions(groups).filter(
    (group) => !group.archived_at && !excluded.has(group.id),
  );
  const label =
    kind === "create"
      ? "New folder"
      : kind === "edit"
        ? "Edit folder"
        : "Archive folder";
  const Icon =
    kind === "create" ? FolderPlus : kind === "edit" ? Pencil : Archive;
  async function action(state: ActionState, form: FormData) {
    const result = await (kind === "archive" ? archiveSuite : saveSuite)(
      state,
      form,
    );
    if (result.success) setOpen(false);
    return result;
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <Icon className="size-4" />
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-2 text-lg font-semibold">
            {label}
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-muted-foreground">
            {kind === "archive"
              ? `Archive ${current?.name} and all of its subfolders. Cases stay in the library and plans; run history is preserved.`
              : "Organize cases into folders inside your library."}
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3"
              aria-label="Close folder dialog"
            >
              <X className="size-4" />
            </Button>
          </Dialog.Close>
          <ActionForm
            action={action}
            submit={
              kind === "create"
                ? "Create folder"
                : kind === "edit"
                  ? "Save folder"
                  : "Archive folder"
            }
            variant={kind === "archive" ? "destructive" : "default"}
          >
            <input name="project_id" type="hidden" value={projectId} />
            {kind !== "create" && current ? (
              <input name="id" type="hidden" value={current.id} />
            ) : null}
            {kind !== "archive" ? (
              <>
                <Field label="Folder name" htmlFor={`folder-name-${kind}`}>
                  <Input
                    name="name"
                    id={`folder-name-${kind}`}
                    defaultValue={kind === "edit" ? current?.name : ""}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="Parent folder" htmlFor={`folder-parent-${kind}`}>
                  <Select
                    name="parent_id"
                    id={`folder-parent-${kind}`}
                    defaultValue={
                      kind === "edit"
                        ? (current?.parent_id ?? "")
                        : current?.archived_at
                          ? ""
                          : (current?.id ?? "")
                    }
                  >
                    <option value="">Library (top level)</option>
                    {parents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.path}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Description"
                  htmlFor={`folder-description-${kind}`}
                >
                  <Textarea
                    name="description"
                    id={`folder-description-${kind}`}
                    defaultValue={kind === "edit" ? current?.description : ""}
                    maxLength={10000}
                  />
                </Field>
              </>
            ) : null}
          </ActionForm>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function GroupControls({
  projectId,
  groups,
  current,
}: {
  projectId: string;
  groups: CaseGroup[];
  current?: CaseGroup;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <FolderDialog
        projectId={projectId}
        groups={groups}
        current={current}
        kind="create"
      />
      {current && !current.archived_at ? (
        <>
          <FolderDialog
            projectId={projectId}
            groups={groups}
            current={current}
            kind="edit"
          />
          <FolderDialog
            projectId={projectId}
            groups={groups}
            current={current}
            kind="archive"
          />
        </>
      ) : null}
    </div>
  );
}
