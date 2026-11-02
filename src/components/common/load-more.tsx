"use client";

import type { PaginationStatus } from "convex/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 24;

export const FIRST_PAGE = { initialNumItems: PAGE_SIZE };

export function LoadMore({
  status,
  loadMore,
  label,
}: {
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  label: string;
}) {
  const pressed = useRef(false);

  useEffect(() => {
    // The button leaves the page with the last rows, and focus must not leave with it.
    if (pressed.current && status === "Exhausted") {
      pressed.current = false;
      if (document.activeElement === document.body) {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    }
  }, [status]);

  if (status !== "CanLoadMore" && status !== "LoadingMore") return null;
  const loading = status === "LoadingMore";
  return (
    <div className="mt-4 flex justify-center">
      <Button
        variant="outline"
        disabled={loading}
        aria-label={`Load more ${label}`}
        onClick={() => {
          pressed.current = true;
          loadMore(PAGE_SIZE);
        }}
      >
        {loading ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}
