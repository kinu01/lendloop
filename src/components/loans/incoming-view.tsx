"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { OwnerActions } from "@/components/loans/loan-actions";
import { LoanList, type LoanRow } from "@/components/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { useUtcToday } from "@/hooks/use-utc-today";
import { formatWaitingCount } from "@/lib/labels";

const TABS = ["needs-reply", "approved", "past"] as const;

function nextStep(loan: LoanRow) {
  if (loan.isOverdue) return `Ask ${loan.borrowerFirstName} to return it:`;
  return loan.hasStarted
    ? `Reach ${loan.borrowerFirstName} at:`
    : `Arrange pickup with ${loan.borrowerFirstName}:`;
}

function LoanGroup({
  group,
  title,
  empty,
  label,
  hideStatus,
  person,
}: {
  group: "pending" | "approved" | "past";
  title: string;
  empty: string;
  label: string;
  hideStatus?: boolean;
  person: (loan: LoanRow) => string;
}) {
  const today = useUtcToday();
  const { results, status, loadMore } = usePaginatedQuery(
    api.loans.incoming,
    { today, group },
    FIRST_PAGE,
  );
  return (
    <>
      <h2 className="sr-only">{title}</h2>
      <LoanList
        viewer="owner"
        loans={status === "LoadingFirstPage" ? undefined : results}
        empty={empty}
        headingLevel={3}
        hideStatus={hideStatus}
        person={person}
        nextStep={nextStep}
        actions={(loan) => (
          <OwnerActions
            loanId={loan._id}
            toolName={loan.toolName}
            borrower={loan.borrowerFirstName}
            status={loan.status}
            hasStarted={loan.hasStarted}
          />
        )}
      />
      <LoadMore status={status} loadMore={loadMore} label={label} />
    </>
  );
}

export function IncomingView() {
  const { tab, setTab } = useTabParam(TABS);
  const waiting = useQuery(api.loans.waitingCount);
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="needs-reply">
          Needs reply{waiting ? ` (${formatWaitingCount(waiting)})` : ""}
        </TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
        <TabsTrigger value="past">Past</TabsTrigger>
      </TabsList>
      <TabsContent value="needs-reply" className="mt-2">
        <LoanGroup
          group="pending"
          title="Needs your reply"
          empty="Nothing is waiting for your reply."
          label="requests waiting for your reply"
          hideStatus
          person={(loan) => `requested by ${loan.borrowerFirstName}`}
        />
      </TabsContent>
      <TabsContent value="approved" className="mt-2">
        <LoanGroup
          group="approved"
          title="Approved"
          empty="No loans are out or booked."
          label="loans"
          person={(loan) =>
            loan.hasStarted
              ? `with ${loan.borrowerFirstName}`
              : `booked by ${loan.borrowerFirstName}`
          }
        />
      </TabsContent>
      <TabsContent value="past" className="mt-2">
        <LoanGroup
          group="past"
          title="Past requests"
          empty="You have no past requests yet."
          label="past requests"
          person={(loan) => `requested by ${loan.borrowerFirstName}`}
        />
      </TabsContent>
    </Tabs>
  );
}
