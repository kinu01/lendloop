"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUtcToday } from "@/hooks/use-utc-today";
import { describeActivity } from "@/lib/activity";
import { formatRange } from "@/lib/labels";
import { timeAgo } from "@/lib/time";

export function AllLoansTable() {
  const today = useUtcToday();
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listAllLoans,
    { today },
    FIRST_PAGE,
  );
  if (status === "LoadingFirstPage") return <Loading />;
  if (results.length === 0)
    return <p className="my-4">There are no loans yet.</p>;
  return (
    <>
      <Table labelledBy="loans-heading">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Tool</TableHead>
            <TableHead scope="col">Borrower</TableHead>
            <TableHead scope="col">Owner</TableHead>
            <TableHead scope="col">Dates</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Latest update</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((loan) => (
            <TableRow key={loan._id}>
              <TableHead
                scope="row"
                className="min-w-40 text-sm font-semibold whitespace-normal text-foreground"
              >
                {loan.toolName}
                {loan.toolRemoved ? (
                  <span className="text-muted-foreground"> (removed)</span>
                ) : null}
              </TableHead>
              <TableCell>{loan.borrowerFirstName}</TableCell>
              <TableCell>{loan.ownerFirstName}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatRange(loan.startDate, loan.endDate)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={loan.status}
                  isOverdue={loan.isOverdue}
                  hasStarted={loan.hasStarted}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {loan.latestActivity
                  ? `${describeActivity(loan.latestActivity, "admin")} ${timeAgo(loan.latestActivity.at)}`
                  : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMore status={status} loadMore={loadMore} label="loans" />
    </>
  );
}
