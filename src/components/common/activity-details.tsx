import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ActivityDetails({
  className,
  ...props
}: ComponentProps<"details">) {
  return (
    <details
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function ActivitySummary({
  className,
  ...props
}: ComponentProps<"summary">) {
  return (
    <summary className={cn("cursor-pointer py-3", className)} {...props} />
  );
}
