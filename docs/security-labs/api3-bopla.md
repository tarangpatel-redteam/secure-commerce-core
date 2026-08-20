# API3:2023 — Broken Object Property Level Authorization (BOPLA)

Phase 5 training scenario. Everything here is synthetic and isolated to
`/api/v1/lab/bopla/*` plus the `lab_bopla_profiles` table. No production
endpoint, table or real user data is involved.

## Scenario

A customer "lab profile" object mixes three classes of property:

| Class | Properties |
| --- | --- |
| Readable by owner | `id`, `userId`, `displayName`, `email`, `phone`, `marketingOptIn`, `loyaltyTier`, `updatedAt` |
| Writable by owner | `displayName`, `phone`, `marketingOptIn` |
| Server-owned | `loyaltyTier`, `accountCreditCents`, `isVip`, `internalRiskScore`, `internalNotes`, `supportPin`, `dateOfBirth` |

The vulnerable endpoints enforce authentication and object ownership correctly —
a caller only ever touches their own record — but skip **property-level**
authorization, producing both API3 sub-classes:

1. **Excessive data exposure** — `GET` serialises the entire database row,
   leaking the internal risk score, staff notes, support PIN and date of birth.
2. **Mass assignment** — `PATCH` copies every recognised property from the
   request body onto the row, so a customer can grant themselves store credit,
   VIP status, a `platinum` tier or a clean risk score.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/v1/lab/bopla` | Scenario metadata (auth required, no secrets) |
| `POST` | `/api/v1/lab/bopla` | Reset the two deterministic lab records |
| `GET` | `/api/v1/lab/bopla/profile` | ⚠️ Vulnerable — full-row serialisation |
| `PATCH` | `/api/v1/lab/bopla/profile` | ⚠️ Vulnerable — mass assignment |
| `GET` | `/api/v1/lab/bopla/secure/profile` | Secure — allowlisted projection |
| `PATCH` | `/api/v1/lab/bopla/secure/profile` | Secure — strict write allowlist |

Anonymous callers receive `401` on every route. Training UI: `/lab/bopla`.

## Deterministic data

`public.lab_bopla_reset()` (`SECURITY DEFINER`, `service_role` only) rebuilds one
record for `customer.a@acme-commerce.test` and one for
`customer.b@acme-commerce.test` with fixed fictional values, so every run of the
lab starts from the same state.

## Reproduction

```sh
# as Customer-A
curl -s -X POST  $BASE/api/v1/lab/bopla            -H "authorization: Bearer $TOKEN"
curl -s          $BASE/api/v1/lab/bopla/profile    -H "authorization: Bearer $TOKEN"
curl -s -X PATCH $BASE/api/v1/lab/bopla/profile    -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' \
     -d '{"accountCreditCents":500000,"isVip":true,"loyaltyTier":"platinum"}'
```

The vulnerable `PATCH` returns `200` with `propertyEscalation: true`. The same
request against `/secure/profile` returns `200` with the privileged keys listed
under `rejectedProperties` and the stored values unchanged.

## Remediation

- Return explicit DTOs per audience; never serialise the entity itself.
- Parse writes with a strict allowlist schema and drop unknown keys.
- Keep balances, tiers, flags and scores under server-side business logic only.
- Classify PII/internal properties and assert in tests that they never appear in
  customer-facing responses.
- Report rejected properties so tampering is visible.
- Test both directions: no privileged property leaks on read, no privileged
  property changes on write.

## Tests

```sh
set -a && . ./.env && set +a
python3 tests/security-labs/api3_bopla_test.py
```
