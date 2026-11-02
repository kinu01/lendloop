"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { TrustedToggle } from "@/components/admin/trusted-toggle";
import { FIRST_PAGE, LoadMore } from "@/components/common/load-more";
import { Loading } from "@/components/common/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { capitalize } from "@/lib/labels";

export function UsersTable() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listUsers,
    {},
    FIRST_PAGE,
  );
  if (status === "LoadingFirstPage") return <Loading />;
  return (
    <>
      <Table labelledBy="people-heading">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col">Email</TableHead>
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">Trusted Lender</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((user) => (
            <TableRow key={user._id}>
              <TableHead
                scope="row"
                className="min-w-40 text-sm font-semibold whitespace-normal text-foreground"
              >
                {user.name}
              </TableHead>
              <TableCell>{user.email}</TableCell>
              <TableCell>{capitalize(user.role)}</TableCell>
              <TableCell>
                <TrustedToggle
                  userId={user._id}
                  name={user.name}
                  trusted={user.isTrustedLender}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMore status={status} loadMore={loadMore} label="people" />
    </>
  );
}
