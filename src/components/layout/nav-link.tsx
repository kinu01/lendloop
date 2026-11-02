"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center whitespace-nowrap text-muted-foreground hover:text-foreground aria-[current=page]:border-b-2 aria-[current=page]:border-primary aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
      aria-current={pathname === href ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
