import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  dockerCompose,
  dockerComposeWithInput,
  n8nIsUp,
  requireStack,
  tableRows,
  type AutomationEvent,
} from "./helpers";

requireStack();

const TEST_ID = "LLtestFailSched1";
const TEST_NAME = "LendLoop test: failing reminders";
const COPY_PATH = "/tmp/lendloop-test-failing-reminders.json";

type Node = { name: string; parameters: Record<string, unknown> };

// `n8n execute` does not start error workflows, so only a real scheduled run proves this path.
function failingCopy() {
  const workflow = JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../n8n/workflows/overdue-reminders.json"),
      "utf8",
    ),
  ) as { nodes: Node[] } & Record<string, unknown>;
  for (const node of workflow.nodes) {
    if (node.name === "Every day at 09:00 UTC") {
      node.parameters = {
        rule: {
          interval: [{ field: "cronExpression", expression: "* * * * *" }],
        },
      };
    }
    if (node.name === "Fetch overdue loans") {
      node.parameters = {
        ...node.parameters,
        url: "={{ $env.LENDLOOP_CONVEX_SITE_URL }}/n8n/no-such-route",
      };
    }
  }
  return JSON.stringify({ ...workflow, id: TEST_ID, name: TEST_NAME });
}

async function restartN8n() {
  await dockerCompose("Restarting n8n", "restart", "n8n");
  await expect.poll(n8nIsUp, { timeout: 60_000 }).toBe(true);
}

function failureRows() {
  return tableRows<AutomationEvent>("automationEvents").then((rows) =>
    rows.filter((row) => row.kind === "failure" && row.workflow === TEST_NAME),
  );
}

test("a failed scheduled reminder run reaches the error workflow and is stored in Convex", async () => {
  // Earlier runs leave rows behind, and only a row from this run proves anything.
  const known = new Set((await failureRows()).map((row) => row._id));
  await dockerComposeWithInput(
    "Copying the test workflow",
    failingCopy(),
    "exec",
    "-T",
    "n8n",
    "sh",
    "-c",
    `cat > ${COPY_PATH}`,
  );
  await dockerCompose(
    "Importing the test workflow",
    "exec",
    "-T",
    "n8n",
    "n8n",
    "import:workflow",
    `--input=${COPY_PATH}`,
  );
  await dockerCompose(
    "Publishing the test workflow",
    "exec",
    "-T",
    "n8n",
    "n8n",
    "publish:workflow",
    `--id=${TEST_ID}`,
  );
  try {
    await restartN8n();
    await expect
      .poll(
        async () => (await failureRows()).filter((row) => !known.has(row._id)),
        { timeout: 150_000, intervals: [5_000] },
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'The step "Fetch overdue loans" failed.',
          }),
        ]),
      );
  } finally {
    await dockerCompose(
      "Unpublishing the test workflow",
      "exec",
      "-T",
      "n8n",
      "n8n",
      "unpublish:workflow",
      `--id=${TEST_ID}`,
    );
    await restartN8n();
  }
});
