import { execFileSync } from "node:child_process";

const WORKFLOW_IDS = [
  "LLrequestNotify1",
  "LLoverdueRemind1",
  "LLautomationErr1",
];
const n8n = (...args) =>
  execFileSync("docker", ["compose", "exec", "-T", "n8n", "n8n", ...args], {
    stdio: "inherit",
  });

n8n("import:workflow", "--separate", "--input=/workflows");
for (const id of WORKFLOW_IDS) n8n("publish:workflow", `--id=${id}`);
execFileSync("docker", ["compose", "restart", "n8n"], { stdio: "inherit" });
console.log("Imported and published the LendLoop workflows. n8n restarted.");
