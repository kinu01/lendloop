import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  CONVEX_SITE_URL,
  FAILURES_PATH,
  n8nLogLines,
  N8N_URL,
  postSigned,
  readSecrets,
  requireStack,
  tableRows,
  WEBHOOK_PATH,
  type AutomationEvent,
} from "./helpers";

requireStack();

const WORKFLOW = "LendLoop: request notification";

function failureEvents() {
  return tableRows<AutomationEvent>("automationEvents").then((rows) =>
    rows.filter((row) => row.kind === "failure" && row.workflow === WORKFLOW),
  );
}

async function expectOneFailureStored(
  request: APIRequestContext,
  brokenBody: string,
  contentType?: string,
) {
  const { CONVEX_TO_N8N_SECRET, N8N_TO_CONVEX_SECRET } = readSecrets();
  const known = new Set((await failureEvents()).map((row) => row._id));
  const newFailures = async () =>
    (await failureEvents()).filter((row) => !known.has(row._id));

  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    brokenBody,
    CONVEX_TO_N8N_SECRET,
    contentType,
  );
  expect(response.status()).toBe(500);

  await expect
    .poll(async () => (await newFailures()).length, { timeout: 30_000 })
    .toBe(1);
  const [failure] = await newFailures();
  const executionId = failure!.executionId!;
  expect(failure!.message).toMatch(/^The step ".+" failed\.$/);

  await expect
    .poll(async () =>
      (await n8nLogLines()).some(
        (line) =>
          line.includes("[automation failure]") &&
          line.includes(`workflow="${WORKFLOW}" execution=${executionId} `),
      ),
    )
    .toBe(true);

  const replay = await postSigned(
    request,
    CONVEX_SITE_URL,
    FAILURES_PATH,
    JSON.stringify({ workflow: WORKFLOW, executionId, message: "replayed" }),
    N8N_TO_CONVEX_SECRET,
  );
  expect(replay.status()).toBe(200);
  const rows = (await failureEvents()).filter(
    (row) => row.executionId === executionId,
  );
  expect(rows.map((row) => row._id)).toEqual([failure!._id]);
  expect(rows[0]!.message).not.toContain("replayed");
  return failure;
}

test("a signed payload with no recipient answers 500 and stores one failure", async ({
  request,
}) => {
  await expectOneFailureStored(
    request,
    JSON.stringify({ eventId: `test-${randomUUID()}`, event: "created" }),
  );
});

test("a signed body that is not JSON, sent as text, answers 500 and stores one failure", async ({
  request,
}) => {
  await expectOneFailureStored(
    request,
    `not json ${randomUUID()}`,
    "text/plain",
  );
});

test("a signed body that is not JSON, sent as JSON, stops at n8n's parser with 422 and stores no failure", async ({
  request,
}) => {
  const { CONVEX_TO_N8N_SECRET } = readSecrets();
  const known = new Set((await failureEvents()).map((row) => row._id));
  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    `not json ${randomUUID()}`,
    CONVEX_TO_N8N_SECRET,
  );
  expect(response.status()).toBe(422);

  // This later failure is stored, so a row from the 422 would be stored by now.
  const failure = await expectOneFailureStored(
    request,
    JSON.stringify({ eventId: `test-${randomUUID()}`, event: "created" }),
  );
  const newRows = (await failureEvents()).filter((row) => !known.has(row._id));
  expect(newRows.map((row) => row._id)).toEqual([failure!._id]);
});
