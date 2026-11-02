import type { Metadata } from "next";
import { RequestsView } from "@/components/loans/requests-view";
import { PageTitle } from "@/components/common/text";

export const metadata: Metadata = { title: "My requests" };

export default function RequestsPage() {
  return (
    <>
      <PageTitle>My requests</PageTitle>
      <RequestsView />
    </>
  );
}
