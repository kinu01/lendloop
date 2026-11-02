import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  CLAIM_PATH,
  CONVEX_SITE_URL,
  overdueFeed,
  postSigned,
  readSecrets,
  remindersFor,
  seedOverdueLoan,
  requireStack,
} from "./helpers";

requireStack();

test("two simultaneous claims for one new loan give exactly one winner", async ({
  request,
}) => {
  const loan = await seedOverdueLoan();
  const { date } = await overdueFeed(request);
  const { N8N_TO_CONVEX_SECRET } = readSecrets();
  const claim = (runId: string) =>
    postSigned(
      request,
      CONVEX_SITE_URL,
      CLAIM_PATH,
      JSON.stringify({ loanId: loan._id, reminderDate: date, runId }),
      N8N_TO_CONVEX_SECRET,
    );

  const runIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  const responses = await Promise.all(runIds.map(claim));
  expect(responses.map((response) => response.status())).toEqual([200, 200]);
  const results = (await Promise.all(
    responses.map((response) => response.json()),
  )) as { claimed: boolean }[];
  expect(results.filter((result) => result.claimed)).toHaveLength(1);
  expect(results.filter((result) => !result.claimed)).toHaveLength(1);

  const rows = await remindersFor(loan._id);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.status).toBe("sending");
  const winner = runIds[results.findIndex((result) => result.claimed)];
  expect(rows[0]!.runId).toBe(winner);
});
