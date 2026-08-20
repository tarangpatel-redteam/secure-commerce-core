# API5:2023 — Broken Function Level Authorization (BFLA)

Phase 4 training scenario for the ACME Commerce Web & API Security Assessment
Environment. Everything here is synthetic and isolated to `/api/v1/lab/bfla/*`.

## Scenario

Moving an order through fulfilment (`paid → processing → shipped → delivered`,
or force-`cancelled`) is a **staff-only function**. The vulnerable lab endpoint
authenticates the caller and validates the input, but never checks whether the
caller holds a staff role. Any signed-in customer can therefore invoke an
administrative operation — vertical privilege escalation.

BOLA (Phase 3) asks *"may this subject touch this record?"*. BFLA asks
*"may this subject invoke this operation at all?"*.

## Prerequisites

- Lovable Cloud backend running with the Phase 1–3 schema.
- Synthetic accounts seeded (password `AcmeLab#2026`):
  - `customer.a@acme-commerce.test` — role `customer`
  - `employee.a@acme-commerce.test` — role `employee`
  - `manager.a@acme-commerce.test` — role `manager`
- Deterministic lab order `LAB-BFLA-A1`, owned by Customer-A, status `paid`,
  created by the service-role-only function `public.lab_bfla_reset()`.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/v1/lab/bfla` | Scenario metadata + lab order + caller roles. Auth required. No secrets. |
| `POST` | `/api/v1/lab/bfla` | Resets the single lab order to `paid`. Auth required; cannot create arbitrary rows or users. |
| `POST` | `/api/v1/lab/bfla/orders/:id/status` | ⚠️ **Vulnerable.** Authenticated, validated, **no role check**. |
| `POST` | `/api/v1/lab/bfla/secure/orders/:id/status` | ✅ Secure. Same work behind an explicit staff-role check. |

Body for both status endpoints:

```json
{ "status": "shipped" }
```

Allowed values: `paid`, `processing`, `shipped`, `delivered`, `cancelled`.
The caller's identity and roles are always derived server-side from the verified
session — never from the body, headers or query string.

## Expected results

| Caller | Vulnerable endpoint | Secure endpoint |
| --- | --- | --- |
| Customer-A (`customer`) | `200` — order status changed (intentional lab failure) | `403 forbidden` — no state change |
| Employee-A (`employee`) | `200` | `200` |
| Manager-A (`manager`) | `200` | `200` |
| Anonymous | `401 unauthorized` | `401 unauthorized` |
| Malformed order id | `400 bad_request` | `400 bad_request` |
| Invalid status value | `400 bad_request` | `400 bad_request` |
| Unknown UUID (staff caller) | `404 not_found` | `404 not_found` |

Production endpoints are unchanged: `/api/v1/orders/:id` stays owner-scoped, and
`/api/v1/orders/:id/cancel` still only allows the owner (or staff) to cancel
orders in a cancellable status. There is no production status-transition
endpoint for customers.

## Lab UI

`/lab/bfla` — not linked from storefront navigation, `noindex`.
Shows the authenticated subject and its roles, the target lab order, a target
status selector, and side-by-side Vulnerable vs Secure panels with real HTTP
method, endpoint, request body, identity, role-check flag, status code, timing
and sanitized response body. Every panel is populated by real `fetch` calls, so
the traffic is fully inspectable in Burp Suite or Postman.

## Remediation

1. **Authorize the function, not just the object.** Check role/permission before
   performing any privileged operation, in addition to ownership checks.
2. **Deny by default.** Put privileged routes behind shared middleware that
   refuses unless a permission is explicitly granted.
3. **Derive entitlements server-side** from the verified session against a
   dedicated `user_roles` table (`has_role`, `is_staff`), never from client input.
4. **Never rely on obscurity.** Unlinked routes and hidden buttons are
   discoverable; treat every reachable method as attacker-visible.
5. **Defence in depth.** Keep RLS and database-side role functions so a
   forgetful handler still fails closed.
6. **Test vertical privilege escalation.** For each privileged operation, assert
   a low-privilege caller gets `403` *and* that no state changed.

## Reset

Use the reset control on `/lab/bfla`, or `POST /api/v1/lab/bfla` with a valid
bearer token. Direct SQL execution of `public.lab_bfla_reset()` is restricted to
the service role; `anon` and `authenticated` have no `EXECUTE` grant.
