"use client";

import { useSyncExternalStore } from "react";
import { todayUtc } from "@convex/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  function schedule() {
    timer = setTimeout(
      () => {
        onChange();
        schedule();
      },
      DAY_MS - (Date.now() % DAY_MS),
    );
  }
  schedule();
  return () => clearTimeout(timer);
}

function snapshot() {
  return todayUtc();
}

// Convex can keep serving a cached query, so the date must be an argument that changes.
export function useUtcToday() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
