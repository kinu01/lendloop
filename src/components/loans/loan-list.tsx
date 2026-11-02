import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { LoanActivity } from "@/components/loans/loan-activity";
import type { Viewer } from "@/lib/activity";
import { StatusBadge } from "@/components/common/status-badge";
import { formatRange } from "@/lib/labels";
import { Loading } from "@/components/common/loading";
import { LINK_STYLES } from "@/components/common/text";
import { cn } from "@/lib/utils";

export type LoanRow = FunctionReturnType<
  typeof api.loans.myRequests
>["page"][number];

export function LoanList({
  loans,
  empty,
  person,
  actions,
  nextStep,
  hideStatus = false,
  viewer,
  headingLevel = 2,
}: {
  loans: LoanRow[] | undefined;
  empty: string;
  person: (loan: LoanRow) => string;
  actions?: (loan: LoanRow) => ReactNode;
  nextStep?: (loan: LoanRow) => string;
  hideStatus?: boolean;
  viewer: Viewer;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (loans === undefined) return <Loading />;
  if (loans.length === 0) return <p className="my-4">{empty}</p>;
  return (
    <ul className="rounded-md border border-border bg-card">
      {loans.map((loan) => (
        <li
          key={loan._id}
          className="grid grid-cols-1 gap-x-4 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Heading className="text-title font-bold wrap-anywhere">
                {loan.toolName}
                {loan.toolRemoved ? (
                  <span className="text-muted-foreground"> (removed)</span>
                ) : null}
              </Heading>
              {hideStatus ? null : (
                <StatusBadge
                  status={loan.status}
                  isOverdue={loan.isOverdue}
                  hasStarted={loan.hasStarted}
                />
              )}
            </div>
            <p className="mt-1 wrap-anywhere text-muted-foreground">
              {formatRange(loan.startDate, loan.endDate)} · {person(loan)}
            </p>
            {loan.contactEmail && nextStep ? (
              <p className="mt-1 wrap-anywhere">
                {nextStep(loan)}{" "}
                <a
                  href={`mailto:${loan.contactEmail}`}
                  className={cn(
                    LINK_STYLES,
                    "inline-flex min-h-11 items-center wrap-anywhere",
                  )}
                >
                  {loan.contactEmail}
                </a>
              </p>
            ) : null}
          </div>
          <div className="mt-2 self-center sm:mt-0 sm:max-w-96">
            {actions?.(loan)}
          </div>
          <div className="col-span-full">
            <LoanActivity
              loanId={loan._id}
              latest={loan.latestActivity}
              viewer={viewer}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
