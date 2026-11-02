"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BoardToolCard } from "@/components/tools/board-tool-card";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import { ToolGrid } from "@/components/tools/tool-grid";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Hint } from "@/components/common/text";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { useUtcToday } from "@/hooks/use-utc-today";
import { CATEGORIES, capitalize, isCategory } from "@/lib/labels";

export function BoardView() {
  const { category, setCategory } = useBoardFilters();
  const today = useUtcToday();
  const { results, status, loadMore } = usePaginatedQuery(
    api.tools.list,
    category ? { today, category } : { today },
    FIRST_PAGE,
  );
  const stillLoading = status === "LoadingFirstPage";

  const anyTrusted = results.some((tool) => tool.ownerIsTrustedLender);
  const count =
    status === "Exhausted"
      ? `${results.length} ${results.length === 1 ? "tool" : "tools"}`
      : `First ${results.length} tools shown`;
  const noMatch = category
    ? "No tools are listed in this category."
    : "No tools are listed yet. List one under My listings.";
  const trustedNote = anyTrusted
    ? " A Trusted Lender badge means an admin has checked this lender."
    : "";
  const countLine =
    results.length === 0 && status === "Exhausted"
      ? noMatch
      : `${count}.${trustedNote}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field className="w-auto">
          <FieldLabel htmlFor="category-filter">Category</FieldLabel>
          <NativeSelect
            id="category-filter"
            name="category"
            value={category}
            onChange={(e) =>
              setCategory(isCategory(e.target.value) ? e.target.value : "")
            }
          >
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {CATEGORIES.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {capitalize(c)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Hint role="status">{stillLoading ? "" : countLine}</Hint>
      {stillLoading ? (
        <Loading label="Loading tools…" />
      ) : (
        <>
          <ToolGrid>
            {results.map((tool) => (
              <BoardToolCard key={tool._id} tool={tool} />
            ))}
          </ToolGrid>
          <LoadMore status={status} loadMore={loadMore} label="tools" />
        </>
      )}
    </>
  );
}
