import type { Doc } from "../_generated/dataModel";

export function toUserView(user: Doc<"users">) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isTrustedLender: user.isTrustedLender,
  };
}
