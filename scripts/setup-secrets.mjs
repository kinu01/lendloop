import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = "n8n/.env";
const NAMES = [
  "CONVEX_TO_N8N_SECRET",
  "N8N_TO_CONVEX_SECRET",
  "N8N_ENCRYPTION_KEY",
];

const current = existsSync(ENV_FILE)
  ? Object.fromEntries(
      readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => [
          line.slice(0, line.indexOf("=")),
          line.slice(line.indexOf("=") + 1),
        ]),
    )
  : {};

const rotate = process.argv.includes("--rotate");
const values = {};
for (const name of NAMES) {
  const keep = current[name] && !(rotate && name !== "N8N_ENCRYPTION_KEY");
  values[name] = keep ? current[name] : randomBytes(32).toString("hex");
}

writeFileSync(
  ENV_FILE,
  NAMES.map((name) => `${name}=${values[name]}`).join("\n") + "\n",
  { mode: 0o600 },
);

// Piped through stdin so the values never appear in the process list.
for (const name of ["CONVEX_TO_N8N_SECRET", "N8N_TO_CONVEX_SECRET"]) {
  execFileSync("npx", ["convex", "env", "set", name], {
    input: values[name],
    stdio: ["pipe", "ignore", "inherit"],
  });
}
execFileSync(
  "npx",
  [
    "convex",
    "env",
    "set",
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/lendloop-request",
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

console.log(
  `Wrote ${ENV_FILE} and set the Convex variables. No values were printed.`,
);
if (rotate) {
  console.log("Run `docker compose up -d` so n8n picks up the new secrets.");
}
