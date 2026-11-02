"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import { AvailabilityBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUtcToday } from "@/hooks/use-utc-today";
import { capitalize, hasOpenLoan } from "@/lib/labels";

export function ListingsTable() {
  const today = useUtcToday();
  const remove = useMutation(api.tools.remove);
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listTools,
    { today },
    FIRST_PAGE,
  );
  if (status === "LoadingFirstPage") return <Loading />;
  if (results.length === 0)
    return <p className="my-4">No tools are listed yet.</p>;
  return (
    <>
      <Table labelledBy="listings-heading">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Tool</TableHead>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col">Owner</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((tool) => (
            <TableRow key={tool._id}>
              <TableHead
                scope="row"
                className="min-w-40 text-sm font-semibold whitespace-normal text-foreground"
              >
                {tool.name}
              </TableHead>
              <TableCell>{capitalize(tool.category)}</TableCell>
              <TableCell>{tool.ownerFirstName}</TableCell>
              <TableCell>
                <AvailabilityBadge availability={tool.availability} />
              </TableCell>
              <TableCell className="text-right">
                <ConfirmDialog
                  label="Remove"
                  subject={tool.name}
                  question={
                    hasOpenLoan(tool)
                      ? `Remove ${tool.name} from LendLoop? A loan already under way stays open until the owner closes it. Future loans and pending requests will be declined.`
                      : `Remove ${tool.name} from LendLoop? Pending requests for it will be declined.`
                  }
                  confirmLabel="Yes, remove"
                  doneMessage={`${tool.name} is removed.`}
                  danger
                  onConfirm={() => remove({ toolId: tool._id })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMore status={status} loadMore={loadMore} label="tools" />
    </>
  );
}
