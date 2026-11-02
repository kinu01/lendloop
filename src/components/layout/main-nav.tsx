"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { NavLink } from "@/components/layout/nav-link";
import { useSession } from "@/hooks/use-session";
import { formatWaitingCount } from "@/lib/labels";

const LINKS = [
  { href: "/board", label: "All tools" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming requests" },
] as const;

export function MainNav() {
  const { isReady } = useSession();
  const waiting = useQuery(api.loans.waitingCount, isReady ? {} : "skip");
  return (
    <nav aria-label="Main" className="flex-1 max-sm:order-3 max-sm:basis-full">
      <ul className="flex flex-wrap gap-x-4 sm:gap-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <NavLink href={link.href}>
              {link.label}
              {link.href === "/incoming" && waiting
                ? ` (${formatWaitingCount(waiting)})`
                : ""}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
