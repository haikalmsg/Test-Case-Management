import Link from "next/link";
import { ArrowUpRight, FolderOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label,
  icon: Icon = FolderOpen,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-xl bg-primary/8 p-3 text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {href ? (
        <Button asChild className="mt-5">
          <Link href={href}>
            {label}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
export function Metric({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{title}</span>
          <Icon className="size-4" />
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">
          {value}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
const statusColors: Record<string, string> = {
  passed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  blocked: "bg-amber-50 text-amber-700",
  skipped: "bg-violet-50 text-violet-700",
  untested: "bg-slate-100 text-slate-600",
  active: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  critical: "bg-rose-50 text-rose-700",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-blue-50 text-blue-700",
  low: "bg-slate-100 text-slate-600",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn(statusColors[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Run progress"
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
