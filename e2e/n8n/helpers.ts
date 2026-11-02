import { execFile, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv, promisify } from "node:util";
import { expect, test, type APIRequestContext } from "@playwright/test";

const exec = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const CONVEX_BIN = path.join(ROOT, "node_modules/.bin/convex");

export const N8N_URL = process.env.N8N_URL ?? "http://127.0.0.1:5678";
export const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
export const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3211";

export const WEBHOOK_PATH = "/webhook/lendloop-request";
export const OVERDUE_PATH = "/n8n/overdue-loans";
export const REMINDERS_PATH = "/n8n/reminders";
export const CLAIM_PATH = "/n8n/reminders/claim";
export const FAILURES_PATH = "/n8n/automation-failures";

async function isUp(url: string) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return true;
  } catch {
    return false;
  }
}

async function findProblem() {
  if (!existsSync(path.join(ROOT, "n8n/.env"))) {
    return "n8n/.env is missing. Run `npm run secrets:setup`.";
  }
  if (!(await isUp(`${N8N_URL}/healthz`))) {
    return `n8n is not reachable at ${N8N_URL}. Run \`docker compose up -d\`.`;
  }
  const convexUp =
    (await isUp(`${CONVEX_URL}/version`)) && (await isUp(CONVEX_SITE_URL));
  if (!convexUp) {
    return `Convex is not reachable at ${CONVEX_URL} and ${CONVEX_SITE_URL}. Run \`npm run dev:backend\`.`;
  }
  return null;
}

const seededLoans: string[] = [];

// A stopped stack must fail the run. Skipping would report a pass with nothing checked.
export function requireStack() {
  test.beforeAll(async () => {
    expect(await findProblem()).toBeNull();
  });
  test.afterEach(async () => {
    for (const loanId of seededLoans.splice(0)) {
      await run("Removing a seeded loan", CONVEX_BIN, [
        "run",
        "seed:removeOverdueLoan",
        JSON.stringify({ loanId }),
      ]);
    }
  });
}

export type Secrets = {
  CONVEX_TO_N8N_SECRET: string;
  N8N_TO_CONVEX_SECRET: string;
};

export function readSecrets(): Secrets {
  const env = parseEnv(readFileSync(path.join(ROOT, "n8n/.env"), "utf8"));
  const { CONVEX_TO_N8N_SECRET, N8N_TO_CONVEX_SECRET } = env;
  if (!CONVEX_TO_N8N_SECRET || !N8N_TO_CONVEX_SECRET) {
    throw new Error("n8n/.env does not hold both signing secrets.");
  }
  return { CONVEX_TO_N8N_SECRET, N8N_TO_CONVEX_SECRET };
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function signature(
  secret: string,
  timestamp: number,
  method: string,
  signedPath: string,
  body: string,
) {
  const mac = createHmac("sha256", secret)
    .update(`v1:${timestamp}:${method}:${signedPath}:${body}`)
    .digest("hex");
  return `v1=${mac}`;
}

export function signedHeaders(
  secret: string,
  method: string,
  signedPath: string,
  body: string,
  timestamp = nowSeconds(),
) {
  return {
    "X-LendLoop-Timestamp": String(timestamp),
    "X-LendLoop-Signature": signature(
      secret,
      timestamp,
      method,
      signedPath,
      body,
    ),
  };
}

export function postSigned(
  request: APIRequestContext,
  baseUrl: string,
  signedPath: string,
  body: string,
  secret: string,
  contentType = "application/json",
) {
  return request.post(`${baseUrl}${signedPath}`, {
    // Playwright re-encodes a string that is not valid JSON when the content
    // type is JSON, which would change the signed bytes. A Buffer goes as is.
    data: Buffer.from(body),
    headers: {
      "Content-Type": contentType,
      ...signedHeaders(secret, "POST", signedPath, body),
    },
  });
}

// Errors are rebuilt from the label alone: Node's message repeats the command
// line, which can hold a real email, and the output can hold more of them.
async function run(label: string, command: string, args: string[]) {
  try {
    const { stdout } = await exec(command, args, {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch {
    throw new Error(`${label} failed. Run it by hand to see why.`);
  }
}

export async function tableRows<T>(table: string, limit = 500): Promise<T[]> {
  const stdout = await run(`Reading the ${table} table`, CONVEX_BIN, [
    "data",
    table,
    "--limit",
    String(limit),
    "--format",
    "jsonLines",
  ]);
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as T);
}

export type Loan = {
  _id: string;
  ownerId: string;
  status: string;
  endDate: string;
};
export type Reminder = {
  _id: string;
  loanId: string;
  status: string;
  runId: string;
};
export type AutomationEvent = {
  _id: string;
  loanId?: string;
  kind: string;
  status?: string;
  event?: string;
  attempt?: number;
  willRetry?: boolean;
  problem?: string;
  workflow?: string;
  executionId?: string;
  message?: string;
};

export async function seedOverdueLoan(): Promise<Loan> {
  const stdout = await run("Seeding an overdue loan", CONVEX_BIN, [
    "run",
    "seed:overdueLoan",
  ]);
  const loanId = JSON.parse(stdout.trim()) as string;
  seededLoans.push(loanId);
  const seeded = (await tableRows<Loan>("loans")).find(
    (loan) => loan._id === loanId,
  );
  if (!seeded) throw new Error("The seeded loan is missing.");
  return seeded;
}

export async function remindersFor(loanId: string) {
  const rows = await tableRows<Reminder>("reminders");
  return rows.filter((row) => row.loanId === loanId);
}

export type FeedRow = {
  loanId: string;
  borrowerEmail: string;
  borrowerFirstName: string;
  toolName: string;
  endDate: string;
};

export async function overdueFeed(request: APIRequestContext) {
  const { N8N_TO_CONVEX_SECRET } = readSecrets();
  const response = await request.get(`${CONVEX_SITE_URL}${OVERDUE_PATH}`, {
    headers: signedHeaders(N8N_TO_CONVEX_SECRET, "GET", OVERDUE_PATH, ""),
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as { date: string; loans: FeedRow[] };
}

export function n8nLogLines() {
  return run("Reading the n8n log", "docker", [
    "compose",
    "logs",
    "n8n",
    "--no-color",
    "--since",
    "15m",
  ]).then((log) => log.split("\n"));
}

// The CLI prints its run output on its own stdout, so reminder lines from this
// command never reach `docker compose logs`.
export async function runReminderWorkflow() {
  const stdout = await run("The reminder workflow", "npm", [
    "run",
    "--silent",
    "n8n:remind-now",
  ]);
  return stdout.split("\n");
}

export async function convexRun(label: string, fn: string, args: object) {
  return run(label, CONVEX_BIN, ["run", fn, JSON.stringify(args)]);
}

export async function dockerCompose(label: string, ...args: string[]) {
  return run(label, "docker", ["compose", ...args]);
}

export function dockerComposeWithInput(
  label: string,
  input: string,
  ...args: string[]
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("docker", ["compose", ...args], {
      cwd: ROOT,
      stdio: ["pipe", "ignore", "ignore"],
    });
    child.on("error", () => reject(new Error(`${label} failed.`)));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} failed.`)),
    );
    child.stdin.end(input);
  });
}

export async function n8nIsUp() {
  return isUp(`${N8N_URL}/healthz`);
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name!.slice(0, 1)}***@${domain}`;
}
