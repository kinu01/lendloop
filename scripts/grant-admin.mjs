import { execFileSync } from "node:child_process";

const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:grant -- someone@example.com");
  process.exit(1);
}

try {
  execFileSync(
    "npx",
    [
      "convex",
      "run",
      "users:setRole",
      JSON.stringify({ email, role: "admin" }),
    ],
    { stdio: "inherit" },
  );
} catch {
  process.exit(1);
}
