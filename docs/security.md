# Security and data minimization

This page lists what could go wrong, what stops it, and what proves it.

## Threats

| Threat                                     | What stops it                                                                                                                                         | Proof                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A user acts on someone else's tool or loan | `authedQuery` and `adminMutation` wrappers load the caller from the verified token, and `lib/permissions.ts` checks ownership                         | `convex/permissions.test.ts`, a table of every public function against five callers, which fails if a new function has no row |
| A browser claims to be an admin            | The role lives only in the Convex `users` table, and only an internal function changes it                                                             | The same table, and `e2e/signed-in`                                                                                           |
| A forged webhook                           | HMAC signature over time, method, path and body, with one secret per direction                                                                        | `convex/http.test.ts`, `e2e/n8n`                                                                                              |
| A captured request replayed                | A 300-second window stops old ones, and write-backs are idempotent. A notification replayed inside the window does send again, which is a known limit | `convex/http.test.ts`, `e2e/n8n`                                                                                              |
| The public list used to see tools on loan  | The public query only accepts a date within a day of the server's date                                                                                | `convex/tools.test.ts`                                                                                                        |
| A tool name forging a log line             | Names refuse control characters, and n8n strips them from log lines                                                                                   | `convex/tools.test.ts`, `e2e/n8n/webhook.spec.ts`                                                                             |
| A retry creates a duplicate reminder       | Claim before sending, one record per loan per day, serializable transactions                                                                          | `convex/http.test.ts`, `e2e/n8n/claim`                                                                                        |
| Two people book the same dates             | Approval checks for an overlapping approved loan inside the transaction                                                                               | `convex/loans.test.ts`                                                                                                        |
| Injected script                            | React escapes output, and a per-request nonce CSP blocks inline script                                                                                | `e2e/public`                                                                                                                  |
| Another site frames the app                | `frame-ancestors 'none'` and `X-Frame-Options: DENY`                                                                                                  | `e2e/public`                                                                                                                  |
| A secret reaches git                       | Git-ignored env files, the export check, and gitleaks in CI                                                                                           | `npm run n8n:check`, CI                                                                                                       |
| A request and cancel loop spams an owner   | A per-user rate limit, because each request notifies the owner                                                                                        | `convex/loans.test.ts`                                                                                                        |
| One user fills the board                   | At most 50 active listings and 20 open requests per user, and a rate limit on listing                                                                 | `convex/tools.test.ts`                                                                                                        |
| Demo data reaches production               | The seed refuses to run unless `ALLOW_DEMO_SEED` is set                                                                                               | `convex/seed.test.ts`                                                                                                         |

The app has no route handlers or server actions, and Convex calls carry a bearer token instead of a cookie, so there is no CSRF surface.

## Common web risks and encryption

The table covers the OWASP risks that apply here: broken access control, injection, cryptographic failures in signing, security misconfiguration through headers and CSP, and vulnerable dependencies through `npm audit` in CI. This is my own review and not a formal OWASP assessment.

Locally, everything runs over HTTP on this machine. In production, all traffic must use HTTPS. Clerk and Convex store the data, so encryption at rest depends on those services and on n8n's database, and it should be confirmed before real data goes in.

## What each person can see

| Data                | Who sees it                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Tool name, category | Anyone. A test checks that the public query returns only these and an id                                     |
| Owner's first name  | Signed-in users, on the board                                                                                |
| An email address    | The two people on an approved loan, until it ends, so they can meet. Admins see all emails, to manage people |
| Failure details     | Admins only. A loan's two people see only that a run failed                                                  |

## What leaves the app

- **Webhook payloads** carry the recipient's first name and email, the tool name, the dates, the event, the loan id and an event id. Only an approval also carries the owner's first name and email.
- **The overdue feed** carries the borrower's email and first name, the tool name, the end date and the loan id.
- **Logs** hold IDs and codes in Convex. The one exception is a command-line seed function, whose error names the email the developer typed. The n8n mock sender masks emails (`t***@example.com`). Tests check that no email reaches the Convex logs.
- **n8n history** keeps failed runs only, and deletes them after 7 days, because they can hold a payload.
