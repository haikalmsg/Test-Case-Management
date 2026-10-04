import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-medium capitalize",
        className,
      )}
      {...props}
    />
  );
}
