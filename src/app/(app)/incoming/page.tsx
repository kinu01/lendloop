import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/common/loading";
import { IncomingView } from "@/components/loans/incoming-view";
import { PageTitle } from "@/components/common/text";

export const metadata: Metadata = { title: "Incoming requests" };

export default function IncomingPage() {
  return (
    <>
      <PageTitle>Incoming requests</PageTitle>
      {/* The chosen tab is in the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<Loading />}>
        <IncomingView />
      </Suspense>
    </>
  );
}
