"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { NavLink } from "@/components/layout/nav-link";
import { useSession } from "@/hooks/use-session";

export function AdminLink() {
  const { isReady } = useSession();
  const me = useQuery(api.users.me, isReady ? {} : "skip");
  if (me?.role !== "admin") return null;
  return (
    <nav aria-label="Admin">
      <NavLink href="/admin">Admin</NavLink>
    </nav>
  );
}
