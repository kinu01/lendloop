import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MainNav } from "./main-nav";
import { SessionGate } from "./session-gate";
import { SessionProvider } from "./session-provider";

const shell = {
  isLoading: false,
  isReady: false,
  error: null as string | null,
  needsSignIn: false,
  retry: vi.fn(),
};

vi.mock("@/hooks/use-store-user", () => ({ useStoreUser: () => shell }));
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));
vi.mock("@clerk/nextjs", () => ({
  SignOutButton: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  Object.assign(shell, {
    isLoading: false,
    isReady: false,
    error: null,
    needsSignIn: false,
  });
  shell.retry.mockClear();
});

function renderShell() {
  render(
    <SessionProvider>
      <MainNav />
      <SessionGate>page content</SessionGate>
    </SessionProvider>,
  );
}

test("the nav shows while loading, so the page does not jump", () => {
  shell.isLoading = true;
  renderShell();
  expect(screen.getByRole("link", { name: "My listings" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Loading…");
  expect(screen.queryByText("page content")).toBeNull();
});

test("a failed account setup offers a retry", () => {
  shell.error = "Please try later.";
  renderShell();
  expect(screen.getByRole("alert").textContent).toBe("Please try later.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(shell.retry).toHaveBeenCalledTimes(1);
});

test("an unconfirmed sign-in explains itself instead of showing a blank page", () => {
  shell.needsSignIn = true;
  renderShell();
  expect(screen.getByRole("alert").textContent).toContain(
    "could not confirm your sign-in",
  );
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});

test("the page shows once the account is ready", () => {
  shell.isReady = true;
  renderShell();
  expect(screen.getByText("page content")).toBeTruthy();
});
