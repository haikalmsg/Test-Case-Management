import type { Tables } from "@/lib/supabase/database.types";

export type CaseGroup = Pick<
  Tables<"suites">,
  "id" | "name" | "parent_id" | "description" | "archived_at"
>;

export function groupAncestors(groups: CaseGroup[], id: string) {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const chain: CaseGroup[] = [];
  const visited = new Set<string>();
  let group = byId.get(id);
  while (group && !visited.has(group.id)) {
    visited.add(group.id);
    chain.unshift(group);
    group = group.parent_id ? byId.get(group.parent_id) : undefined;
  }
  return chain;
}

export function groupDescendants(groups: CaseGroup[], id: string) {
  const children = new Map<string, string[]>();
  for (const group of groups)
    if (group.parent_id)
      children.set(group.parent_id, [
        ...(children.get(group.parent_id) ?? []),
        group.id,
      ]);
  const ids = new Set<string>();
  const pending = groups.some((group) => group.id === id) ? [id] : [];
  while (pending.length) {
    const next = pending.pop()!;
    if (ids.has(next)) continue;
    ids.add(next);
    pending.push(...(children.get(next) ?? []));
  }
  return [...ids];
}

export function groupOptions(groups: CaseGroup[]) {
  return groups
    .map((group) => {
      const chain = groupAncestors(groups, group.id);
      return {
        ...group,
        path: chain.map((parent) => parent.name).join(" / "),
        depth: chain.length - 1,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
}

export function withGroupPaths<
  T extends { suites: { id: string; name: string } | null },
>(rows: T[], groups: CaseGroup[]) {
  const paths = new Map(
    groupOptions(groups).map((group) => [group.id, group.path]),
  );
  return rows.map((row) => ({
    ...row,
    suites: row.suites
      ? { ...row.suites, name: paths.get(row.suites.id) ?? row.suites.name }
      : null,
  }));
}
