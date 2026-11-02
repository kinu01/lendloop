"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import { ListingCard } from "@/components/tools/listing-card";
import { ToolGrid } from "@/components/tools/tool-grid";
import { useUtcToday } from "@/hooks/use-utc-today";

export function ListingsView() {
  const today = useUtcToday();
  const { results, status, loadMore } = usePaginatedQuery(
    api.tools.myListings,
    { today },
    FIRST_PAGE,
  );
  return (
    <section aria-label="Your tools">
      {status === "LoadingFirstPage" ? (
        <Loading label="Loading your tools…" />
      ) : results.length === 0 ? (
        <p className="my-4">You have not listed any tools yet.</p>
      ) : (
        <ToolGrid>
          {results.map((tool) => (
            <ListingCard key={tool._id} tool={tool} />
          ))}
        </ToolGrid>
      )}
      <LoadMore status={status} loadMore={loadMore} label="tools" />
    </section>
  );
}
