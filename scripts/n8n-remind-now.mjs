import { spawnSync } from "node:child_process";

// The CLI prints the whole run, with borrower emails, so only the masked reminder lines pass through.
const run = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "-e",
    "N8N_RUNNERS_BROKER_PORT=5690",
    "-e",
    "N8N_PORT=5691",
    "n8n",
    "n8n",
    "execute",
    "--id=LLoverdueRemind1",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const reminders = run.stdout
  .split("\n")
  .filter((line) => line.includes("[mock reminder"));
for (const line of reminders) console.log(line);

if (run.status !== 0) {
  console.error("The reminder run failed. See its execution in n8n.");
  process.exit(1);
}
console.log(`The reminder run finished: ${reminders.length} sent.`);
