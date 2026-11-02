import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useTabParam } from "./use-tab-param";

let search = "";
const replaceState = vi.spyOn(window.history, "replaceState");

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(search),
}));

const TABS = ["listings", "people"] as const;

beforeEach(() => {
  replaceState.mockClear();
  search = "";
});

test("opens the first tab by default", () => {
  const { result } = renderHook(() => useTabParam(TABS));
  expect(result.current.tab).toBe("listings");
});

test("reads the tab from the URL, and ignores an unknown one", () => {
  search = "tab=people";
  const { result } = renderHook(() => useTabParam(TABS));
  expect(result.current.tab).toBe("people");
  search = "tab=secrets";
  const { result: bad } = renderHook(() => useTabParam(TABS));
  expect(bad.current.tab).toBe("listings");
});

test("writes the tab to the URL, and the first tab keeps the plain path", () => {
  const { result } = renderHook(() => useTabParam(TABS));
  act(() => result.current.setTab("people"));
  expect(replaceState).toHaveBeenLastCalledWith(null, "", "/admin?tab=people");
  act(() => result.current.setTab("listings"));
  expect(replaceState).toHaveBeenLastCalledWith(null, "", "/admin");
});
