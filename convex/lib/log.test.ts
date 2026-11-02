import { expect, test, vi } from "vitest";
import { logWarning } from "./log";

test("writes one JSON line of facts, and a fact cannot replace the log name", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  logWarning("notification_failed", { event: "created", attempt: 1 });
  expect(warn).toHaveBeenCalledWith(
    '{"event":"created","attempt":1,"log":"notification_failed"}',
  );
  warn.mockRestore();
});
