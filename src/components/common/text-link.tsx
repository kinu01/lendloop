import Link from "next/link";
import type { ComponentProps } from "react";
import { LINK_STYLES } from "./text";
import { cn } from "@/lib/utils";

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(LINK_STYLES, className)} {...props} />;
}
