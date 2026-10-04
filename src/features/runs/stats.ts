export const resultStatuses = [
  "untested",
  "passed",
  "failed",
  "blocked",
  "skipped",
] as const;
export type ResultStatus = (typeof resultStatuses)[number];
export function runStats(cases: { status: ResultStatus }[]) {
  const counts = Object.fromEntries(
    resultStatuses.map((s) => [s, 0]),
  ) as Record<ResultStatus, number>;
  for (const row of cases) counts[row.status]++;
  const total = cases.length;
  const done = total - counts.untested;
  const denominator = counts.passed + counts.failed;
  return {
    counts,
    total,
    done,
    progress: total ? Math.round((done / total) * 100) : 0,
    passRate: denominator
      ? Math.round((counts.passed / denominator) * 100)
      : null,
  };
}
