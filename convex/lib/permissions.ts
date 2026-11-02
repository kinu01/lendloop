import type { Doc } from "../_generated/dataModel";
import { fail } from "./errors";

type User = Doc<"users">;

export function isAdmin(user: User) {
  return user.role === "admin";
}

export function requireToolOwner(
  tool: Doc<"tools">,
  user: User,
  message: string,
) {
  if (tool.ownerId !== user._id) fail("FORBIDDEN", message);
}

export function requireToolOwnerOrAdmin(
  tool: Doc<"tools">,
  user: User,
  message: string,
) {
  if (tool.ownerId !== user._id && !isAdmin(user)) fail("FORBIDDEN", message);
}

export function requireNotToolOwner(tool: Doc<"tools">, user: User) {
  if (tool.ownerId === user._id)
    fail("INVALID", "You cannot borrow your own tool.");
}

export function requireLoanOwner(
  loan: Doc<"loans">,
  user: User,
  message: string,
) {
  if (loan.ownerId !== user._id) fail("FORBIDDEN", message);
}

export function requireLoanBorrower(
  loan: Doc<"loans">,
  user: User,
  message: string,
) {
  if (loan.borrowerId !== user._id) fail("FORBIDDEN", message);
}

export function requireLoanPartyOrAdmin(loan: Doc<"loans">, user: User) {
  const involved = loan.borrowerId === user._id || loan.ownerId === user._id;
  if (!involved && !isAdmin(user))
    fail("FORBIDDEN", "You are not part of this loan.");
}
