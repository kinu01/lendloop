import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const LINK_STYLES = "text-link underline underline-offset-[0.15em]";

export function PageTitle(props: ComponentProps<"h1">) {
  return <h1 className="mt-6 mb-4 text-2xl font-bold" {...props} />;
}

export function SectionTitle(props: ComponentProps<"h2">) {
  return <h2 className="my-4 scroll-mt-4 text-xl font-bold" {...props} />;
}

export function Hint({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
