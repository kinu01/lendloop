import { vi } from "vitest";

export const convex = {
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
  usePreloadedQuery: vi.fn(),
  useConvexAuth: vi.fn(),
};

export function paginated<T>(
  results: T[],
  status: "Exhausted" | "CanLoadMore" | "LoadingFirstPage" = "Exhausted",
) {
  return { results, status, loadMore: vi.fn(), isLoading: false };
}
