import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useBoardFilters } from "./use-board-filters";

let search = "";
const replaceState = vi.spyOn(window.history, "replaceState");

vi.mock("next/navigation", () => ({
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  replaceState.mockClear();
  search = "";
});

test("reads the category from the URL and ignores an unknown one", () => {
  search = "category=garden";
  const { result } = renderHook(() => useBoardFilters());
  expect(result.current.category).toBe("garden");
  search = "category=weapons";
  const { result: bad } = renderHook(() => useBoardFilters());
  expect(bad.current.category).toBe("");
});

test("choosing a category writes it to the URL", () => {
  const { result } = renderHook(() => useBoardFilters());
  act(() => result.current.setCategory("garden"));
  expect(replaceState).toHaveBeenCalledWith(null, "", "/board?category=garden");
});

test("clearing the category goes back to the plain path", () => {
  search = "category=garden";
  const { result } = renderHook(() => useBoardFilters());
  act(() => result.current.setCategory(""));
  expect(replaceState).toHaveBeenCalledWith(null, "", "/board");
});
