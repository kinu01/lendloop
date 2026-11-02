import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import {
  n8nLogLines,
  N8N_URL,
  nowSeconds,
  postSigned,
  readSecrets,
  signature,
  signedHeaders,
  requireStack,
  WEBHOOK_PATH,
} from "./helpers";

requireStack();

const WEBHOOK_URL = `${N8N_URL}${WEBHOOK_PATH}`;
const JSON_HEADER = { "Content-Type": "application/json" };

function payload() {
  const id = randomUUID();
  const recipientEmail = `recipient-${id}@demo.lendloop.test`;
  const contactEmail = `contact-${id}@demo.lendloop.test`;
  return {
    recipientEmail,
    contactEmail,
    eventId: `test-${id}`,
    body: JSON.stringify({
      eventId: `test-${id}`,
      event: "approved",
      loanId: `test-loan-${id}`,
      toolName: "Test drill",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      recipient: { firstName: "Rita", email: recipientEmail },
      contact: { firstName: "Cole", email: contactEmail },
    }),
  };
}

async function notificationLine(eventId: string) {
  const lines = await n8nLogLines();
  return lines.find(
    (line) =>
      line.includes("[mock notification]") &&
      line.includes(`event=${eventId} `),
  );
}

// The accepted call goes last, so once its line shows up, any line the rejected
// call could have caused has already been written.
async function expectNotDelivered(
  request: APIRequestContext,
  ...eventIds: string[]
) {
  const { CONVEX_TO_N8N_SECRET } = readSecrets();
  const probe = payload();
  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    probe.body,
    CONVEX_TO_N8N_SECRET,
  );
  expect(response.status()).toBe(200);
  await expect.poll(() => notificationLine(probe.eventId)).toBeTruthy();
  for (const eventId of eventIds) {
    expect(await notificationLine(eventId)).toBeUndefined();
  }
}

async function expectRejected(response: APIResponse) {
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "invalid signature" });
}

test("an unsigned call gets 401 and notifies nobody", async ({ request }) => {
  const { body, eventId } = payload();
  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: JSON_HEADER,
  });
  await expectRejected(response);
  await expectNotDelivered(request, eventId);
});

test("a wrong signature gets 401 and notifies nobody", async ({ request }) => {
  const { body, eventId } = payload();
  const timestamp = nowSeconds();
  const response = await request.post(WEBHOOK_URL, {
    data: body,
    headers: {
      ...JSON_HEADER,
      "X-LendLoop-Timestamp": String(timestamp),
      "X-LendLoop-Signature": signature(
        "not-the-secret",
        timestamp,
        "POST",
        WEBHOOK_PATH,
        body,
      ),
    },
  });
  await expectRejected(response);
  await expectNotDelivered(request, eventId);
});

for (const [name, skew] of [
  ["an expired", -301],
  // The clock can tick before n8n checks, so 301 could land exactly on the 300 second limit.
  ["a future", 330],
] as const) {
  test(`${name} timestamp gets 401 even with a correct signature`, async ({
    request,
  }) => {
    const { body, eventId } = payload();
    const { CONVEX_TO_N8N_SECRET } = readSecrets();
    const response = await request.post(WEBHOOK_URL, {
      data: body,
      headers: {
        ...JSON_HEADER,
        ...signedHeaders(
          CONVEX_TO_N8N_SECRET,
          "POST",
          WEBHOOK_PATH,
          body,
          nowSeconds() + skew,
        ),
      },
    });
    await expectRejected(response);
    await expectNotDelivered(request, eventId);
  });
}

test("a body changed after signing gets 401 and notifies nobody", async ({
  request,
}) => {
  const signed = payload();
  const changed = payload();
  const { CONVEX_TO_N8N_SECRET } = readSecrets();
  const response = await request.post(WEBHOOK_URL, {
    data: changed.body,
    headers: {
      ...JSON_HEADER,
      ...signedHeaders(CONVEX_TO_N8N_SECRET, "POST", WEBHOOK_PATH, signed.body),
    },
  });
  await expectRejected(response);
  await expectNotDelivered(request, signed.eventId, changed.eventId);
});

test("a multipart call gets 401 and does not crash the signature step", async ({
  request,
}) => {
  const response = await request.post(WEBHOOK_URL, {
    headers: {
      "X-LendLoop-Timestamp": String(nowSeconds()),
      "X-LendLoop-Signature": `v1=${"0".repeat(64)}`,
    },
    multipart: { field: "value" },
  });
  expect(response.status()).toBe(401);
});

test("a line break in a tool name cannot forge a log line", async ({
  request,
}) => {
  const { body, eventId } = payload();
  const marker = `forged-${randomUUID()}`;
  const parsed = JSON.parse(body) as Record<string, unknown>;
  parsed.toolName = `Drill\n[mock notification] event=${marker} to=x`;
  const { CONVEX_TO_N8N_SECRET } = readSecrets();
  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    JSON.stringify(parsed),
    CONVEX_TO_N8N_SECRET,
  );
  expect(response.status()).toBe(200);
  await expect.poll(() => notificationLine(eventId)).toBeTruthy();
  const lines = (await n8nLogLines()).filter((line) => line.includes(marker));
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain(`event=${eventId} `);
});

test("a signed payload gets 200 and logs one masked notification", async ({
  request,
}) => {
  const { body, eventId, recipientEmail, contactEmail } = payload();
  const { CONVEX_TO_N8N_SECRET } = readSecrets();
  const response = await postSigned(
    request,
    N8N_URL,
    WEBHOOK_PATH,
    body,
    CONVEX_TO_N8N_SECRET,
  );
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });

  await expect.poll(() => notificationLine(eventId)).toBeTruthy();
  const line = await notificationLine(eventId);
  expect(line).toContain("to=r***@demo.lendloop.test");
  expect(line).toContain("Arrange pickup with Cole at c***@demo.lendloop.test");

  const log = (await n8nLogLines()).join("\n");
  expect(log.split(`event=${eventId} `)).toHaveLength(2);
  expect(log).not.toContain(recipientEmail);
  expect(log).not.toContain(contactEmail);
});
