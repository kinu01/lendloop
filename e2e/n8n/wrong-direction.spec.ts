import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  CLAIM_PATH,
  CONVEX_SITE_URL,
  FAILURES_PATH,
  N8N_URL,
  OVERDUE_PATH,
  overdueFeed,
  postSigned,
  readSecrets,
  REMINDERS_PATH,
  remindersFor,
  seedOverdueLoan,
  signedHeaders,
  requireStack,
  tableRows,
  WEBHOOK_PATH,
  type AutomationEvent,
} from "./helpers";

requireStack();

test("the n8n webhook rejects a signature made with the Convex secret", async ({
  request,
}) => {
  const { N8N_TO_CONVEX_SECRET } = readSecrets();
  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    JSON.stringify({ eventId: `test-${randomUUID()}` }),
    N8N_TO_CONVEX_SECRET,
  );
  expect(response.status()).toBe(401);
});

test("the overdue feed rejects a signature made with the n8n secret", async ({
  request,
}) => {
  const { CONVEX_TO_N8N_SECRET, N8N_TO_CONVEX_SECRET } = readSecrets();
  const get = (secret: string) =>
    request.get(`${CONVEX_SITE_URL}${OVERDUE_PATH}`, {
      headers: signedHeaders(secret, "GET", OVERDUE_PATH, ""),
    });
  expect((await get(CONVEX_TO_N8N_SECRET)).status()).toBe(401);
  expect((await get(N8N_TO_CONVEX_SECRET)).status()).toBe(200);
});

test("the Convex write endpoints reject a signature made with the n8n secret and write nothing", async ({
  request,
}) => {
  const { CONVEX_TO_N8N_SECRET, N8N_TO_CONVEX_SECRET } = readSecrets();
  const loan = await seedOverdueLoan();
  const { date } = await overdueFeed(request);
  const runId = `test-${randomUUID()}`;
  const calls = [
    {
      path: CLAIM_PATH,
      body: { loanId: loan._id, reminderDate: date, runId },
    },
    {
      path: REMINDERS_PATH,
      body: { loanId: loan._id, reminderDate: date, runId, status: "sent" },
    },
    {
      path: FAILURES_PATH,
      body: { workflow: runId, executionId: runId, message: "forged" },
    },
  ];

  for (const { path, body } of calls) {
    const forged = await postSigned(
      request,
      CONVEX_SITE_URL,
      path,
      JSON.stringify(body),
      CONVEX_TO_N8N_SECRET,
    );
    expect(forged.status(), `${path} with the wrong secret`).toBe(401);

    // A 400 shows the right secret passes the signature check on this path,
    // so the 401 above came from the secret and not from something else.
    const control = await postSigned(
      request,
      CONVEX_SITE_URL,
      path,
      "{}",
      N8N_TO_CONVEX_SECRET,
    );
    expect(control.status(), `${path} with the right secret`).toBe(400);
  }

  expect(await remindersFor(loan._id)).toEqual([]);
  const events = await tableRows<AutomationEvent>("automationEvents");
  expect(events.filter((event) => event.loanId === loan._id)).toEqual([]);
  expect(
    events.filter((event) => JSON.stringify(event).includes(runId)),
  ).toEqual([]);
});
