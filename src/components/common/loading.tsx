"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SLOW_AFTER_MS = 10_000;

export function Loading({ label = "Loading…" }: { label?: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mt-6 text-muted-foreground" role="status">
      <p className="mb-2">{label}</p>
      {slow ? (
        <>
          <p className="mb-2">
            This is taking longer than usual. Check your connection.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </>
      ) : null}
    </div>
  );
}
