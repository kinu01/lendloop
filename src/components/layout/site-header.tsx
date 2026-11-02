import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({
  brandCurrent = false,
  end,
  children,
}: {
  brandCurrent?: boolean;
  end?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 border-b border-border bg-card px-4 py-2 sm:min-h-16 sm:gap-y-3 sm:py-3">
      <Link
        href="/"
        className="text-lg font-bold"
        aria-current={brandCurrent ? "page" : undefined}
      >
        LendLoop
      </Link>
      {children}
      {end ? <div className="ml-auto min-h-8.5 min-w-8.5">{end}</div> : null}
    </header>
  );
}
