"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { errorMessage } from "@/lib/errors";

export function useStoreUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);
  const [state, setState] = useState<
    { status: "idle" | "stored" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    store({})
      .then(() => {
        if (!cancelled) setState({ status: "stored" });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
      setState({ status: "idle" });
    };
  }, [isAuthenticated, store, attempt]);

  return {
    isLoading: isLoading || (isAuthenticated && state.status === "idle"),
    isReady: isAuthenticated && state.status === "stored",
    error: state.status === "error" ? state.message : null,
    needsSignIn: !isLoading && !isAuthenticated,
    retry,
  };
}
