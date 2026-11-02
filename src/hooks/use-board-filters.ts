"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { isCategory, type Category } from "@/lib/labels";

export function useBoardFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("category");
  const category: Category | "" = isCategory(raw) ? raw : "";

  function setCategory(next: Category | "") {
    const query = new URLSearchParams(params.toString());
    if (next) query.set("category", next);
    else query.delete("category");
    const url = query.toString();
    // The list reloads from Convex, so a server navigation would be wasted.
    window.history.replaceState(
      null,
      "",
      url ? `${pathname}?${url}` : pathname,
    );
  }

  return { category, setCategory };
}
