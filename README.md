# ACME Commerce — Web & API Security Assessment Environment

ACME Commerce is a realistic e-commerce application (catalogue, cart, checkout,
orders, roles) that doubles as a **controlled internship lab** for the OWASP API
Security Top 10. The storefront and its production `/api/v1` endpoints are built
secure-by-default; every intentional weakness is isolated inside the
`/api/v1/lab/*` namespace and operates on synthetic data only.

Built with TanStack Start, React, TypeScript, Tailwind CSS and a PostgreSQL
backend (Supabase) with row-level security.

## Development

```sh
npm i
npm run dev      # http://localhost:8080
```

## Storefront routes

| Route | Purpose |
| --- | --- |
| `/` | Home, featured catalogue, lab overview |
| `/products`, `/products/:slug` | Catalogue and product detail |
| `/login`, `/register` | Authentication |
| `/cart`, `/checkout` | Bag and multi-step checkout (mock payment) |
| `/account` | Profile, role, address book |
| `/orders`, `/orders/:id` | Order history and detail |
| `/labs` | Security lab index |

## Production API (`/api/v1`) — secure

| Endpoint | Notes |
| --- | --- |
| `GET /products`, `GET /products/:slug`, `GET /categories` | Public, active rows only |
| `GET /me` | Requires bearer token; returns verified identity + roles |
| `GET/POST /cart`, `PATCH/DELETE /cart/items/:itemId` | Owner-scoped |
| `GET/POST /addresses`, `PUT/DELETE /addresses/:id` | Owner-scoped |
| `GET/POST /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` | Owner-scoped, staff read via `is_staff()` |
| `GET /staff/customers` | Staff roles only |

Security properties: bearer tokens are re-validated server-side with
`auth.getUser()`, roles are read from the database (never from the client), all
queries go through the parameterized PostgREST client under RLS, every request
body is validated with Zod, and responses are `no-store` + `nosniff`.

## Completed lab scenarios

| Phase | OWASP | Scenario | UI | Lab namespace | Docs |
| --- | --- | --- | --- | --- | --- |
| 3 | API1:2023 | Broken Object Level Authorization | `/lab/bola` | `/api/v1/lab/bola/*` | [docs](docs/security-labs/api1-bola.md) |
| 4 | API5:2023 | Broken Function Level Authorization | `/lab/bfla` | `/api/v1/lab/bfla/*` | [docs](docs/security-labs/api5-bfla.md) |
| 5 | API3:2023 | Broken Object Property Level Authorization | `/lab/bopla` | `/api/v1/lab/bopla/*` | [docs](docs/security-labs/api3-bopla.md) |
| 6 | API2:2023 | Broken Authentication | `/lab/broken-auth` | `/api/v1/lab/broken-auth/*` | [docs](docs/security-labs/api2-broken-auth.md) |
| 7 | API4:2023 | Unrestricted Resource Consumption | `/lab/resource-consumption` | `/api/v1/lab/resource-consumption/*` | [docs](docs/security-labs/api4-resource-consumption.md) |

Each scenario ships a **vulnerable** endpoint and a **secure** counterpart under
`.../secure/...`, so the same request can be replayed against both and compared.

## Test accounts

Synthetic accounts, no real identities. Password for all storefront accounts:
`AcmeLab#2026`.

| Account | Email | Role |
| --- | --- | --- |
| Customer-A | `customer.a@acme-commerce.test` | customer |
| Customer-B | `customer.b@acme-commerce.test` | customer |
| Employee-A | `employee.a@acme-commerce.test` | employee |
| Manager-A | `manager.a@acme-commerce.test` | manager |
| Administrator-A | `administrator.a@acme-commerce.test` | administrator |

The broken-authentication lab uses its own synthetic identity store
(`nora.vance`, `milo.hart`, `ops.desk`) whose credentials are printed on the
`/lab/broken-auth` page after a reset. No production credential, service-role
key or payment data is ever sent to the browser.

## Resetting / reseeding lab data

Every lab exposes a reset control in its UI, backed by `POST` on the lab's index
endpoint (which calls a `SECURITY DEFINER` reset function restricted to the
service role):

```
POST /api/v1/lab/bola
POST /api/v1/lab/bfla
POST /api/v1/lab/bopla
POST /api/v1/lab/broken-auth
POST /api/v1/lab/resource-consumption
```

`GET` on the same paths returns the scenario metadata (object IDs, usernames,
quotas) needed to build requests. Resets are idempotent and restore the exact
deterministic fixtures, so a scenario can be re-run any number of times.

## Burp Suite workflow

1. Sign in to the app in a browser proxied through Burp (`127.0.0.1:8080` proxy;
   install the Burp CA certificate first).
2. Open a lab page and run one request — the page shows the exact method, URL,
   body and response.
3. In **Proxy → HTTP history**, find the `/api/v1/lab/...` call and send it to
   **Repeater** (`Ctrl+R`). The `Authorization: Bearer <token>` header is already
   present; the token is a short-lived session JWT.
4. Tamper the interesting value (object UUID, `status`, extra JSON properties,
   `pageSize`, `username`/`code`) and resend.
5. Send the identical request to the `.../secure/...` path and diff the two
   responses — that difference is the control being demonstrated.
6. Use **Intruder** for the enumeration, brute-force and OTP scenarios, and
   **Turbo Intruder / Repeater tab groups** for the resource-consumption and
   burst tests.

## Remediation guidance (summary)

- **BOLA** — authorize on the object, not the route: every read/write must
  re-check ownership server-side (or rely on RLS with the caller's token).
- **BFLA** — gate privileged functions on a server-side role lookup; never trust
  a role claim supplied by the client.
- **BOPLA** — project responses through an explicit allowlist and accept only an
  explicit set of writable properties (no object spread into the update).
- **Broken authentication** — generic error messages, attempt throttling and
  lockout, CSPRNG session tokens, expiring single-use OTPs compared in constant
  time.
- **Resource consumption** — enforce page-size ceilings, work-factor limits,
  per-user rate limits with `Retry-After`, and budget caps on costly actions.

Full write-ups live in `docs/security-labs/`.

## Automated security tests

```sh
set -a && . ./.env && set +a
python3 tests/security-labs/api1_bola_test.py
python3 tests/security-labs/api5_bfla_test.py
python3 tests/security-labs/api3_bopla_test.py
python3 tests/security-labs/api2_broken_auth_test.py
python3 tests/security-labs/api4_resource_consumption_test.py
```

Each suite asserts both that the vulnerable path is exploitable **and** that the
secure path and the production endpoints are not.

## Scope and safety

This environment is for authorised, isolated training only. All catalogue,
customer, order, payment and identity data is synthetic; payments are a mock
service with `test_success` / `test_decline` outcomes. Do not point the lab
scenarios at systems you do not own.
