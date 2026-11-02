import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/common/loading";
import { BoardView } from "@/components/tools/board-view";
import { PageTitle } from "@/components/common/text";

export const metadata: Metadata = { title: "All tools" };

export default function BoardPage() {
  return (
    <>
      <PageTitle>All tools</PageTitle>
      {/* The category filter reads the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<Loading label="Loading tools…" />}>
        <BoardView />
      </Suspense>
    </>
  );
}
