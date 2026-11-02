import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Auth } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type DatabaseReader } from "../_generated/server";
import { fail } from "./errors";

type AuthCtx = { auth: Auth; db: DatabaseReader };

async function currentUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED", "Please sign in.");
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) fail("UNAUTHENTICATED", "Your account is still being set up.");
  return user;
}

async function currentAdmin(ctx: AuthCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (user.role !== "admin") fail("FORBIDDEN", "Admins only.");
  return user;
}

const withUser = customCtx(async (ctx: AuthCtx) => ({
  me: await currentUser(ctx),
}));
const withAdmin = customCtx(async (ctx: AuthCtx) => ({
  me: await currentAdmin(ctx),
}));

export const authedQuery = customQuery(query, withUser);
export const authedMutation = customMutation(mutation, withUser);
export const adminQuery = customQuery(query, withAdmin);
export const adminMutation = customMutation(mutation, withAdmin);
