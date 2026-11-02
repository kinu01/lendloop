import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { useMutationState } from "./use-mutation-state";

test("two runs started in the same tick call the task once", async () => {
  const { result } = renderHook(() => useMutationState());
  let finish: () => void = () => {};
  const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));

  let first: Promise<boolean> = Promise.resolve(false);
  let second: Promise<boolean> = Promise.resolve(false);
  act(() => {
    first = result.current.run(task);
    second = result.current.run(task);
  });
  expect(await second).toBe(false);
  await act(async () => {
    finish();
    expect(await first).toBe(true);
  });
  expect(task).toHaveBeenCalledTimes(1);
});

test("a server error becomes a plain message and the next run clears it", async () => {
  const { result } = renderHook(() => useMutationState());
  await act(async () => {
    await result.current.run(() =>
      Promise.reject(
        new ConvexError({ code: "FORBIDDEN", message: "Admins only." }),
      ),
    );
  });
  expect(result.current.error).toBe("Admins only.");
  await act(async () => {
    await result.current.run(() => Promise.resolve());
  });
  expect(result.current.error).toBeNull();
});
