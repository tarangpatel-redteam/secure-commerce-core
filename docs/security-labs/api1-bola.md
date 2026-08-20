# Lab: API1:2023 — Broken Object Level Authorization (BOLA / IDOR)

Isolated, synthetic training scenario inside ACME Commerce. Nothing here touches
real users, external systems or the production-style endpoints.

## Scenario

Customer orders are the object. The vulnerable endpoint authenticates the caller
but never checks that the requested order belongs to them, so any signed-in
customer can read another customer's order by supplying its id.

- Scenario id: `api1-bola-orders`
- OWASP API Security Top 10: **API1:2023 Broken Object Level Authorization**
- Blast radius: `/api/v1/lab/bola/*` only

## Prerequisites

- A signed-in session. All lab endpoints reject anonymous callers with `401`.
- Deterministic lab orders present. `POST /api/v1/lab/bola` rebuilds them.

## Test users

| Label | Email | Lab order |
| --- | --- | --- |
| Customer-A | `customer.a@acme-commerce.test` | `LAB-BOLA-A1` |
| Customer-B | `customer.b@acme-commerce.test` | `LAB-BOLA-B1` |

Both use the shared lab password issued with the synthetic accounts. Order ids
are UUIDs and are returned by the scenario metadata endpoint.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/v1/lab/bola` | Scenario metadata: id, vulnerability, OWASP mapping, description, synthetic users, lab order ids. No passwords, tokens or secrets. |
| `POST` | `/api/v1/lab/bola` | Resets the two fixed lab orders. Cannot create arbitrary users or rows. |
| `POST` | `/api/v1/lab/bola/orders/:id/access` | **Intentionally vulnerable.** Authenticates, validates the id, then returns the order with no ownership check. |
| `POST` | `/api/v1/lab/bola/secure/orders/:id/access` | Secure comparison. Same lookup plus an explicit `order.user_id === session.userId` check; denies otherwise. |

All requests use the standard `Authorization: Bearer <access_token>` header and
the existing `{ data }` / `{ error: { code, message } }` envelope, so they are
directly replayable from Burp Suite or Postman.

## Expected results

Signed in as **Customer-A**, targeting **Customer-B's** order id:

| Endpoint | Expected |
| --- | --- |
| Vulnerable lab | `200` with Customer-B's full order and `crossAccountAccess: true` — the intentional failure |
| Secure lab | `403 forbidden`, no object data |
| Production `/api/v1/orders/:id` | `404 not_found` — unchanged and still secure |

Signed in as Customer-A targeting their **own** order: `200` from both lab
endpoints. Anonymous: `401`. Malformed id: `400 bad_request`.

## Remediation

1. Perform object-level authorization on every lookup: bind the object's owner
   to the authenticated subject before serialising anything.
2. Derive identity server-side from the verified session — never from a body
   field, query parameter or hidden form input.
3. Deny by default; keep database row-level security as a second layer that
   fails closed when a handler forgets.
4. Prefer unpredictable identifiers (UUIDs) as defence in depth, never as the
   control itself.
5. Add automated horizontal-privilege-escalation tests: user A requests user B's
   object and must receive `403`/`404` with no payload.
6. Log and alert on denied cross-account attempts to catch enumeration.

## UI

`/lab/bola` — deliberately excluded from storefront navigation and marked
`noindex, nofollow`. The page issues real HTTP requests to the lab endpoints;
nothing is simulated in frontend state.
