import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/common/loading";
import { AdminView } from "@/components/admin/admin-view";
import { PageTitle } from "@/components/common/text";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <PageTitle>Admin</PageTitle>
      {/* The chosen tab is in the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<Loading />}>
        <AdminView />
      </Suspense>
    </>
  );
}
