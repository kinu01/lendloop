import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  convexRun,
  dockerCompose,
  n8nIsUp,
  n8nLogLines,
  seedOverdueLoan,
  requireStack,
  tableRows,
  type AutomationEvent,
} from "./helpers";

requireStack();

function notificationsFor(loanId: string) {
  return tableRows<AutomationEvent>("automationEvents").then((rows) =>
    rows.filter((row) => row.kind === "notification" && row.loanId === loanId),
  );
}

function sendFromConvex(loanId: string, changedAt: number) {
  return convexRun("Sending a notification", "notify:sendRequestEvent", {
    loanId,
    event: "approved",
    changedAt,
    attempt: 1,
  });
}

test("a real Convex action signs its request, n8n accepts it, and Convex records the delivery", async () => {
  const loan = await seedOverdueLoan();
  const changedAt = Date.now();
  await sendFromConvex(loan._id, changedAt);

  const [event] = await notificationsFor(loan._id);
  expect(event).toMatchObject({
    status: "sent",
    attempt: 1,
    event: "approved",
  });
  await expect
    .poll(async () =>
      (await n8nLogLines()).some(
        (line) =>
          line.includes("[mock notification]") &&
          line.includes(`${loan._id}:approved:${changedAt}`),
      ),
    )
    .toBe(true);
});

test("during an n8n outage Convex records the failure and retries until delivery", async () => {
  const loan = await seedOverdueLoan();
  await dockerCompose("Stopping n8n", "stop", "n8n");
  try {
    await sendFromConvex(loan._id, Date.now());
    const [first] = await notificationsFor(loan._id);
    expect(first).toMatchObject({
      status: "failed",
      attempt: 1,
      willRetry: true,
      problem: "unreachable",
    });
  } finally {
    await dockerCompose("Starting n8n", "start", "n8n");
  }
  await expect.poll(n8nIsUp, { timeout: 60_000 }).toBe(true);

  await expect
    .poll(
      async () =>
        (await notificationsFor(loan._id)).some((row) => row.status === "sent"),
      { timeout: 150_000, intervals: [5_000] },
    )
    .toBe(true);
});

test("a rejected signature is logged with its reason, and no payload", async ({
  request,
}) => {
  const marker = `person-${randomUUID()}@example.com`;
  const response = await request.post(
    "http://127.0.0.1:5678/webhook/lendloop-request",
    { data: { recipient: { email: marker } } },
  );
  expect(response.status()).toBe(401);
  await expect
    .poll(async () =>
      (await n8nLogLines()).some((line) =>
        line.includes("[signature rejected] reason=missing"),
      ),
    )
    .toBe(true);
  expect((await n8nLogLines()).join("\n")).not.toContain(marker);
});
