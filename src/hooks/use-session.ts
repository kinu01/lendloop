"use client";

import { createContext, useContext } from "react";
import type { useStoreUser } from "@/hooks/use-store-user";

type Session = ReturnType<typeof useStoreUser>;

export const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession needs a SessionProvider above it.");
  return session;
}
