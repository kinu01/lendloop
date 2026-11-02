import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Row({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-end gap-3", className)}
      {...props}
    />
  );
}
