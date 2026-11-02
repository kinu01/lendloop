"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function useTabParam<Tab extends string>(
  tabs: readonly [Tab, ...Tab[]],
) {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab = tabs.find((candidate) => candidate === raw) ?? tabs[0];

  function setTab(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next === tabs[0]) query.delete("tab");
    else query.set("tab", next);
    const url = query.toString();
    // The data comes from Convex, so a server navigation would be wasted.
    window.history.replaceState(
      null,
      "",
      url ? `${pathname}?${url}` : pathname,
    );
  }

  return { tab, setTab };
}
