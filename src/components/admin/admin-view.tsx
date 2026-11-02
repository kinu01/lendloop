"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { AllLoansTable } from "@/components/admin/all-loans-table";
import { FailuresList } from "@/components/admin/failures-list";
import { ListingsTable } from "@/components/admin/listings-table";
import { UsersTable } from "@/components/admin/users-table";
import { Loading } from "@/components/common/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

const TABS = ["listings", "loans", "people", "failures"] as const;

function AdminTabs() {
  const { tab, setTab } = useTabParam(TABS);
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="listings">Listings</TabsTrigger>
        <TabsTrigger value="loans">Loans</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="failures">Failures</TabsTrigger>
      </TabsList>
      <TabsContent value="listings" className="mt-2">
        <h2 id="listings-heading" className="sr-only">
          Listings
        </h2>
        <ListingsTable />
      </TabsContent>
      <TabsContent value="loans" className="mt-2">
        <h2 id="loans-heading" className="sr-only">
          All loans
        </h2>
        <AllLoansTable />
      </TabsContent>
      <TabsContent value="people" className="mt-2">
        <h2 id="people-heading" className="sr-only">
          People
        </h2>
        <UsersTable />
      </TabsContent>
      <TabsContent value="failures" className="mt-2">
        <h2 className="sr-only">Automation failures</h2>
        <FailuresList />
      </TabsContent>
    </Tabs>
  );
}

export function AdminView() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Loading />;
  return me.role === "admin" ? (
    <AdminTabs />
  ) : (
    <p className="my-4">This page is for admins only.</p>
  );
}
