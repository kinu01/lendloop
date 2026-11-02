"use client";

import { createContext, useContext } from "react";

export const AnnounceContext = createContext<(message: string) => void>(
  () => {},
);

export function useAnnounce() {
  return useContext(AnnounceContext);
}
