import path from "node:path";

export const ROLES = {
  owner: "E2E_CLERK_OWNER_EMAIL",
  borrower: "E2E_CLERK_BORROWER_EMAIL",
  admin: "E2E_CLERK_ADMIN_EMAIL",
} as const;

export type Role = keyof typeof ROLES;

export function emailFor(role: Role) {
  const email = process.env[ROLES[role]];
  if (!email)
    throw new Error(`Run \`npm run e2e:users\` to set ${ROLES[role]}.`);
  return email;
}

export function sessionFile(role: Role) {
  return path.resolve(__dirname, `../.auth/${role}.json`);
}
