"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnnounceContext } from "@/hooks/use-announce";

const VISIBLE_MS = 6000;

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [notice, setNotice] = useState({ message: "", pathname });

  const clearTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const announce = useCallback(
    (message: string) => {
      clearTimeout(clearTimer.current);
      // Clearing first makes a repeated message count as a change for screen readers.
      setNotice({ message: "", pathname });
      setTimeout(() => setNotice({ message, pathname }), 50);
      clearTimer.current = setTimeout(
        () => setNotice({ message: "", pathname }),
        VISIBLE_MS,
      );
      // The button that was pressed may be gone once its card moves or leaves.
      setTimeout(() => {
        if (document.activeElement === document.body) {
          document.getElementById("main")?.focus({ preventScroll: true });
        }
      }, 0);
    },
    [pathname],
  );

  return (
    <AnnounceContext.Provider value={announce}>
      <p
        role="status"
        className="sticky top-2 z-5 font-semibold text-success not-empty:mt-4 not-empty:rounded-md not-empty:border not-empty:border-border not-empty:bg-success-soft not-empty:px-3 not-empty:py-2"
      >
        {notice.pathname === pathname ? notice.message : ""}
      </p>
      {children}
    </AnnounceContext.Provider>
  );
}
