export const TIMESTAMP_HEADER = "X-LendLoop-Timestamp";
export const SIGNATURE_HEADER = "X-LendLoop-Signature";
export const MAX_SKEW_SECONDS = 300;

const encoder = new TextEncoder();

export function signingString(
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  return `v1:${timestamp}:${method.toUpperCase()}:${path}:${body}`;
}

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function sign(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): Promise<string> {
  const key = await importKey(secret, "sign");
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingString(timestamp, method, path, body)),
  );
  return Array.from(new Uint8Array(mac), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function signedHeaders(
  secret: string,
  method: string,
  path: string,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Record<string, string>> {
  const timestamp = String(nowSeconds);
  const signature = await sign(secret, timestamp, method, path, body);
  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: `v1=${signature}`,
  };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

export async function verify(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  body: string;
  nowSeconds?: number;
}): Promise<VerifyResult> {
  const { timestamp, signature } = input;
  if (!timestamp || !signature) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "malformed" };
  const hex = /^v1=([0-9a-f]{64})$/.exec(signature)?.[1];
  if (!hex) return { ok: false, reason: "malformed" };

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  const expected = new Uint8Array(
    hex.match(/../g)!.map((byte) => parseInt(byte, 16)),
  );
  const key = await importKey(input.secret, "verify");
  // subtle.verify compares in constant time; a string === would leak timing.
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    expected,
    encoder.encode(
      signingString(timestamp, input.method, input.path, input.body),
    ),
  );
  return valid ? { ok: true } : { ok: false, reason: "mismatch" };
}
