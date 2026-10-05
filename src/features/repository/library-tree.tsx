"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Library,
  Files,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { groupAncestors, groupOptions, type CaseGroup } from "./groups";

export function LibraryTree({
  projectId,
  groups,
  selected,
}: {
  projectId: string;
  groups: CaseGroup[];
  selected: string;
}) {
  const [expanded, setExpanded] = useState(
    new Set(groupAncestors(groups, selected).map((group) => group.id)),
  );
  const base = `/projects/${projectId}/cases`;
  const ordered = groupOptions(groups);
  function renderFolder(group: CaseGroup) {
    const children = ordered.filter((child) => child.parent_id === group.id);
    const open = expanded.has(group.id);
    const Icon = open || selected === group.id ? FolderOpen : Folder;
    return (
      <li key={group.id}>
        <div
          className={cn(
            "flex items-center rounded-md",
            selected === group.id && "bg-primary/8 text-primary",
          )}
        >
          {children.length ? (
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded hover:bg-muted"
              aria-label={`${open ? "Collapse" : "Expand"} ${group.name}`}
              aria-expanded={open}
              onClick={() => {
                const next = new Set(expanded);
                if (open) next.delete(group.id);
                else next.add(group.id);
                setExpanded(next);
              }}
            >
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}
          <Link
            href={`${base}?suite=${group.id}`}
            aria-current={selected === group.id ? "page" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-sm hover:text-primary"
            title={group.name}
          >
            <Icon className="size-4 shrink-0 text-amber-500" />
            <span className="truncate">{group.name}</span>
            {group.archived_at ? (
              <span className="text-[10px] text-muted-foreground">
                Archived
              </span>
            ) : null}
          </Link>
        </div>
        {children.length && open ? (
          <ul className="ml-3 border-l pl-2">{children.map(renderFolder)}</ul>
        ) : null}
      </li>
    );
  }
  return (
    <nav aria-label="Case library folders" className="p-3">
      <Link
        href={base}
        aria-current={!selected ? "page" : undefined}
        className={cn(
          "mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-muted",
          !selected && "bg-primary/8 text-primary",
        )}
      >
        <Library className="size-4" />
        Library
      </Link>
      <Link
        href={`${base}?suite=all`}
        aria-current={selected === "all" ? "page" : undefined}
        className={cn(
          "mb-3 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
          selected === "all" && "bg-primary/8 text-primary",
        )}
      >
        <Files className="size-4" />
        All cases
      </Link>
      <ul>
        {ordered
          .filter((group) => !group.parent_id && !group.archived_at)
          .map(renderFolder)}
      </ul>
      {ordered.some((group) => !group.parent_id && group.archived_at) ? (
        <details
          className="mt-4 border-t pt-3"
          open={!!groups.find((group) => group.id === selected)?.archived_at}
        >
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Archived folders
          </summary>
          <ul className="mt-2">
            {ordered
              .filter((group) => !group.parent_id && group.archived_at)
              .map(renderFolder)}
          </ul>
        </details>
      ) : null}
    </nav>
  );
}
