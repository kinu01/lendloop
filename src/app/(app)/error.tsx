"use client";

import { ErrorMessage } from "@/components/common/error-message";

// Keeps the navigation on screen, so one failed page does not strand the user.
export default function AppErrorPage({ reset }: { reset: () => void }) {
  return <ErrorMessage reset={reset} />;
}
