import { describe, expect, test } from "vitest";
import { MAX_SKEW_SECONDS, sign, signedHeaders, verify } from "./hmac";

const secret = "test-secret";
const ts = "1700000000";
const body = '{"a":1}';
const vector =
  "0f060037f0d13d274452a944a1a22cd58684875589224a8c82bc0c098ff11669";

function input(overrides: Partial<Parameters<typeof verify>[0]> = {}) {
  return {
    secret,
    timestamp: ts,
    signature: `v1=${vector}`,
    method: "POST",
    path: "/n8n/reminders",
    body,
    nowSeconds: Number(ts),
    ...overrides,
  };
}

describe("hmac", () => {
  test("signs the known vector (same as Node crypto.createHmac)", async () => {
    expect(await sign(secret, ts, "POST", "/n8n/reminders", body)).toBe(vector);
  });

  test("accepts a valid signature", async () => {
    expect(await verify(input())).toEqual({ ok: true });
  });

  test("accepts a signature from signedHeaders", async () => {
    const headers = await signedHeaders(secret, "GET", "/x", "", 1700000100);
    expect(
      await verify(
        input({
          method: "GET",
          path: "/x",
          body: "",
          timestamp: headers["X-LendLoop-Timestamp"],
          signature: headers["X-LendLoop-Signature"],
          nowSeconds: 1700000100,
        }),
      ),
    ).toEqual({ ok: true });
  });

  test.each([
    ["body", { body: '{"a":2}' }],
    ["path", { path: "/n8n/automation-failures" }],
    ["method", { method: "GET" }],
    ["secret", { secret: "other-secret" }],
  ])("rejects a changed %s", async (_, overrides) => {
    expect(await verify(input(overrides))).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  test("rejects a changed timestamp inside the window", async () => {
    expect(
      await verify(input({ timestamp: "1700000001", nowSeconds: 1700000001 })),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  test("rejects an old timestamp", async () => {
    expect(
      await verify(input({ nowSeconds: Number(ts) + MAX_SKEW_SECONDS + 1 })),
    ).toEqual({ ok: false, reason: "expired" });
  });

  test("rejects a timestamp too far in the future", async () => {
    expect(
      await verify(input({ nowSeconds: Number(ts) - MAX_SKEW_SECONDS - 1 })),
    ).toEqual({ ok: false, reason: "expired" });
  });

  test("accepts a timestamp at the edge of the window", async () => {
    expect(
      await verify(input({ nowSeconds: Number(ts) + MAX_SKEW_SECONDS })),
    ).toEqual({ ok: true });
  });

  test.each([
    ["missing signature", { signature: null }, "missing"],
    ["missing timestamp", { timestamp: null }, "missing"],
    ["no version prefix", { signature: vector }, "malformed"],
    ["short hex", { signature: "v1=abc" }, "malformed"],
    ["uppercase hex", { signature: `v1=${vector.toUpperCase()}` }, "malformed"],
    ["non-numeric timestamp", { timestamp: "soon" }, "malformed"],
  ])("rejects %s", async (_, overrides, reason) => {
    expect(await verify(input(overrides))).toEqual({ ok: false, reason });
  });
});
