"use client";

import { useCallback, useRef, useState } from "react";
import { useAnnounce } from "@/hooks/use-announce";
import { errorMessage } from "@/lib/errors";

export function useMutationState() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State lags one render, so two clicks in the same tick would both start.
  const running = useRef(false);
  const announce = useAnnounce();

  const run = useCallback(
    async (task: () => Promise<unknown>, doneMessage?: string) => {
      if (running.current) return false;
      running.current = true;
      setPending(true);
      setError(null);
      try {
        await task();
        if (doneMessage) announce(doneMessage);
        return true;
      } catch (e) {
        setError(errorMessage(e));
        return false;
      } finally {
        running.current = false;
        setPending(false);
      }
    },
    [announce],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
