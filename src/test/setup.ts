import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { convex } from "./convex-mock";

vi.mock("convex/react", async () => (await import("./convex-mock")).convex);

afterEach(() => {
  cleanup();
  for (const mock of Object.values(convex)) mock.mockReset();
});
