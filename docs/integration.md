# n8n integration

This page explains how Convex and n8n work together, and why the design is reliable. The README has the short version.

## The three workflows

1. **Request notification.** When a request is created, approved, declined, cancelled or returned, the Convex mutation schedules an action in the same transaction. A change that rolls back therefore sends nothing. The action signs the payload and posts it to n8n. n8n verifies the signature, answers 401 if it is wrong, and then writes a mock notification to its log with the email masked. A new or cancelled request goes to the tool owner. An approved, declined or returned loan goes to the borrower.
2. **Overdue reminders.** This runs every day at 09:00 UTC, and it has a "Run now" node for manual runs. It fetches the overdue loans, claims each one, sends a mock reminder only for the claims it won, and writes each result back to Convex.
3. **Automation errors.** This is the error workflow for the other two. It logs the failure and posts a signed report to Convex, and the report appears on the Failures tab of the admin page. The report names the run and not a loan, because an error workflow does not know which loan was in progress. The same tab lists notifications that ran out of attempts and reminders that failed, which Convex records directly.

## Signing, in both directions

- The algorithm is HMAC-SHA256. Each direction has its own secret, so a leak of one secret cannot forge the other direction.
- The headers are `X-LendLoop-Timestamp` (Unix seconds) and `X-LendLoop-Signature: v1=<hex>`.
- The signed string is `v1:<timestamp>:<METHOD>:<path>:<raw body>`. The method and path are included, so a signed GET cannot be replayed as a POST, and a body signed for one endpoint fails on another.
- The receiver rejects a timestamp more than 300 seconds from its own clock, in either direction.
- The receiver checks the exact raw bytes before it parses JSON.
- The comparison takes constant time. Convex uses `crypto.subtle.verify`, because the default Convex runtime has no Node `crypto`. n8n uses `crypto.timingSafeEqual`.
- If a secret is not set, Convex answers 500 and processes nothing.
- Signed requests do not follow redirects, so a signed payload cannot be sent to another host.
- Both receivers log a rejected signature with its reason and never with the payload.

## Where the secrets live

The brief asks for secrets in environment variables and n8n credentials. LendLoop uses environment variables for the signing secrets, and the exports hold no stored credentials.

The reason is that each request needs a new signature over its timestamp, method, path and body, so a Code node computes it. n8n's HTTP Request credentials are documented as fixed header or query values, and I found no documented way to compute a per-request signature with them. A hosted setup would still use credentials for a real email or Slack sender, and the export check allows such a reference, because it holds only an id and a name.

`npm run n8n:check` fails if an export holds instance data, a value from `n8n/.env`, a long hex string, an API key, a JWT, or embedded credential data.

## Idempotent write-backs

- A reminder has at most one record per loan per day, found through the `by_loan_date` index.
- Convex mutations are serializable transactions, so two retries that arrive together cannot both insert.
- n8n claims a reminder before it sends, and a claim is one transaction, so if two runs start together only one sends.
- A `sending` or `failed` record can become `sent`. A `sent` record never changes.
- The overdue feed leaves out loans with a `sending` or `sent` reminder today, and it keeps `failed` ones so they can be tried again.
- A replayed failure report is stored once, because it is keyed on the workflow name and the execution id.

## Retries and visible failures

- **Convex to n8n:** the action retries 3 times, after 10 seconds, 1 minute and 5 minutes. Each attempt records an activity row on the loan.
- **n8n to Convex:** every HTTP Request node tries 3 times in total, 5 seconds apart. If it still fails, the error workflow runs.
- **Delivery is at least once.** If n8n delivers a notification but answers after the 10-second timeout, Convex retries and the notification goes out twice. Each payload has an `eventId`, so a real sender can drop the duplicate. The mock sender does not.
- **The failure report holds the step name only,** because raw error text can quote a payload. The full error stays in the n8n execution history, which is deleted after 7 days.
- **A wrong signing secret cannot report itself.** The report is signed with the same secret, so Convex rejects it. The failure then shows in the n8n and Convex logs, and not on the admin page.

## What the live tests prove

`npm run test:n8n` runs against the real stack. These tests were each checked by breaking what they guard and watching them fail:

- A real Convex action signs a request, n8n accepts it, and Convex records the delivery.
- During a real n8n outage, Convex records the failure and retries until delivery.
- A failed scheduled reminder run reaches the error workflow and is stored in Convex. This test imports a throwaway workflow that runs every minute, because a run from the `n8n execute` command did not start the error workflow.

## Notes about n8n 2

- The error workflow must be published too, or n8n skips it. `npm run n8n:setup` publishes all three.
- A workflow with only a Schedule Trigger cannot run from the command line, which is why the reminders workflow has a "Run now" node. `n8n:remind-now` also moves the command to other ports, because the running server holds the usual ones.
- Code node output reaches the log only with `CODE_ENABLE_STDOUT=true`, and only from `console.log`.
- Code nodes need `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` to read `$env`, and `NODE_FUNCTION_ALLOW_BUILTIN=crypto` to sign.
- The Webhook node needs "Raw Body" turned on, so the signature is checked on the exact bytes that were sent.
