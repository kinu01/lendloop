import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

const ENV_FILE = ".env.local";
const API = "https://api.clerk.com/v1/users";
const USERS = [
  { name: "E2E_CLERK_OWNER_EMAIL", first: "Olu", last: "Owner" },
  { name: "E2E_CLERK_BORROWER_EMAIL", first: "Bola", last: "Borrower" },
  { name: "E2E_CLERK_ADMIN_EMAIL", first: "Ada", last: "Admin" },
];

const current = parseEnv(readFileSync(ENV_FILE, "utf8"));
const secret = current.CLERK_SECRET_KEY;
if (!secret?.startsWith("sk_test_")) {
  console.error("This only runs against a Clerk development instance.");
  process.exit(1);
}
const headers = {
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

async function ensureUser({ name, first, last }) {
  const email = `lendloop-${first.toLowerCase()}+clerk_test@example.com`;
  const search = new URLSearchParams({ email_address: email });
  const found = await fetch(`${API}?${search}`, { headers });
  if (!found.ok) throw new Error(`Clerk answered ${found.status}.`);
  if ((await found.json()).length > 0) {
    console.log(`${name}: already exists.`);
  } else {
    const created = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email_address: [email],
        first_name: first,
        last_name: last,
        skip_password_requirement: true,
      }),
    });
    if (!created.ok) throw new Error(`Clerk answered ${created.status}.`);
    console.log(`${name}: created.`);
  }
  if (current[name]) return;
  // .env.example lists these names with empty values, so fill that line if it is there.
  const text = readFileSync(ENV_FILE, "utf8");
  const empty = new RegExp(`^${name}=$`, "m");
  writeFileSync(
    ENV_FILE,
    empty.test(text)
      ? text.replace(empty, `${name}=${email}`)
      : `${text.replace(/\n?$/, "\n")}${name}=${email}\n`,
  );
}

try {
  for (const user of USERS) await ensureUser(user);
  console.log(`The test users are ready, and ${ENV_FILE} holds their emails.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
