"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import type { api } from "@convex/_generated/api";
import { PUBLIC_LIST_SIZE } from "@convex/lib/validators";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Hint, LINK_STYLES } from "@/components/common/text";
import { TextLink } from "@/components/common/text-link";
import { useUtcToday } from "@/hooks/use-utc-today";
import { capitalize } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PublicToolList({
  preloaded,
  today,
}: {
  preloaded: Preloaded<typeof api.tools.listPublic>;
  today: string;
}) {
  const { tools, hasMore } = usePreloadedQuery(preloaded);
  const router = useRouter();
  const currentDay = useUtcToday();

  // The date is part of the preloaded query, so a new day needs a new server render.
  useEffect(() => {
    if (currentDay !== today) router.refresh();
  }, [currentDay, today, router]);

  if (tools.length === 0) {
    return (
      <p className="my-4">
        No tools are available right now.
        <Show when="signed-out"> Sign in to be the first to lend one.</Show>
      </p>
    );
  }
  return (
    <>
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          // Beside each other across columns, a category would read as part of the next tool.
          <li
            key={tool._id}
            className="flex items-baseline justify-between gap-4 border-b border-border py-3 sm:flex-col sm:items-start sm:justify-start sm:gap-1"
          >
            <p className="text-title font-semibold wrap-anywhere">
              {tool.name}
            </p>
            <p className="text-sm whitespace-nowrap text-muted-foreground">
              {capitalize(tool.category)}
            </p>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Hint className="my-4">
          These are the newest {PUBLIC_LIST_SIZE} available tools.{" "}
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/board">
              <button
                type="button"
                className={cn(LINK_STYLES, "cursor-pointer")}
              >
                Sign in to see them all
              </button>
            </SignInButton>
            .
          </Show>
          <Show when="signed-in">
            <TextLink href="/board">See them all</TextLink>.
          </Show>
        </Hint>
      ) : null}
    </>
  );
}
