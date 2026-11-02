import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { fail } from "./lib/errors";
import { authedQuery } from "./lib/functions";
import { role } from "./lib/validators";
import { toUserView } from "./model/users";

const EMAIL_MAX = 254;
const NAME_MAX = 100;

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) fail("UNAUTHENTICATED", "Please sign in.");
    const email = identity.email?.trim().slice(0, EMAIL_MAX);
    if (!email)
      fail(
        "INVALID",
        "Your sign-in did not include an email address. Add the email claim to the Clerk session token.",
      );
    // Other users see this name, so it must never come from the email address.
    const name = (identity.name?.trim() || "Neighbor").slice(0, NAME_MAX);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existing) {
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch("users", existing._id, { email, name });
      }
      return existing._id;
    }
    return ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      email,
      name,
      role: "user",
      isTrustedLender: false,
    });
  },
});

export const me = authedQuery({
  args: {},
  handler: (ctx) => toUserView(ctx.me),
});

export const setRole = internalMutation({
  args: { email: v.string(), role },
  handler: async (ctx, { email, role }) => {
    const matches = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(2);
    const [user, other] = matches;
    if (!user) fail("NOT_FOUND", `No user with email ${email}. Sign in first.`);
    if (other) fail("INVALID", `More than one account uses ${email}.`);
    await ctx.db.patch("users", user._id, { role });
    return { email, role };
  },
});
