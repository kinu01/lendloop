"use client";

import type { ReactNode } from "react";
import { SessionContext } from "@/hooks/use-session";
import { useStoreUser } from "@/hooks/use-store-user";

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useStoreUser();
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
