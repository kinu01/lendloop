import type { Metadata } from "next";
import { AddToolButton } from "@/components/tools/add-tool-button";
import { ListingsView } from "@/components/tools/listings-view";
import { PageTitle } from "@/components/common/text";

export const metadata: Metadata = { title: "My listings" };

export default function ListingsPage() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>My listings</PageTitle>
        <AddToolButton />
      </div>
      <ListingsView />
    </>
  );
}
