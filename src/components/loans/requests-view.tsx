"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BorrowerActions } from "@/components/loans/loan-actions";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { LoanList } from "@/components/loans/loan-list";
import { useUtcToday } from "@/hooks/use-utc-today";

export function RequestsView() {
  const today = useUtcToday();
  const { results, status, loadMore } = usePaginatedQuery(
    api.loans.myRequests,
    { today },
    FIRST_PAGE,
  );
  return (
    <>
      <LoanList
        viewer="borrower"
        loans={status === "LoadingFirstPage" ? undefined : results}
        empty="You have not asked to borrow anything yet. Find a tool under All tools."
        person={(loan) => `from ${loan.ownerFirstName}`}
        nextStep={(loan) =>
          loan.isOverdue
            ? `This is overdue. Arrange the return with ${loan.ownerFirstName}:`
            : loan.hasStarted
              ? `Reach ${loan.ownerFirstName} at:`
              : `Arrange pickup with ${loan.ownerFirstName}:`
        }
        actions={(loan) => (
          <BorrowerActions
            loanId={loan._id}
            toolName={loan.toolName}
            status={loan.status}
            hasStarted={loan.hasStarted}
          />
        )}
      />
      <LoadMore status={status} loadMore={loadMore} label="requests" />
    </>
  );
}
