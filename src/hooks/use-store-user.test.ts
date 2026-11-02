import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { convex } from "@/test/convex-mock";
import { useStoreUser } from "./use-store-user";

function setup(auth: { isLoading: boolean; isAuthenticated: boolean }) {
  const store = vi.fn(() => Promise.resolve("user1"));
  convex.useConvexAuth.mockReturnValue(auth);
  convex.useMutation.mockReturnValue(store);
  return { store };
}

test("stores the user once signed in, then reports ready", async () => {
  const { store } = setup({ isLoading: false, isAuthenticated: true });
  const { result } = renderHook(() => useStoreUser());
  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(result.current.isReady).toBe(true));
  expect(store).toHaveBeenCalledTimes(1);
});

test("does nothing while signed out, and says sign-in is needed", () => {
  const { store } = setup({ isLoading: false, isAuthenticated: false });
  const { result } = renderHook(() => useStoreUser());
  expect(store).not.toHaveBeenCalled();
  expect(result.current.needsSignIn).toBe(true);
});

test("reports a failure, and retry tries again", async () => {
  const { store } = setup({ isLoading: false, isAuthenticated: true });
  store.mockRejectedValueOnce(new Error("boom"));
  const { result } = renderHook(() => useStoreUser());
  await waitFor(() => expect(result.current.error).not.toBeNull());
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.isReady).toBe(true));
  expect(store).toHaveBeenCalledTimes(2);
});
