# API4:2023 — Unrestricted Resource Consumption (Phase 7)

Scenario id: `api4-unrestricted-resource-consumption-invoice-export`.
Namespace: `/api/v1/lab/resource-consumption/*` (weakness scoped here — the real
ACME catalog, cart, order and checkout endpoints keep their server-side limits).

## Synthetic data

- `public.lab_rc_records` — 500 deterministic invoice rows
  (`ACME-INV-00001` … `ACME-INV-00500`, fixed amounts, regions and dates).
- `public.lab_rc_usage` — per-caller, per-variant consumption counters
  (requests, rows, compute units, notifications, spend, window start).

Both tables have RLS enabled with no policies, so only the service role — used
by the lab handlers — can reach them. `public.lab_rc_reset()` (SECURITY DEFINER,
service-role only) rebuilds the dataset and clears every counter, making runs
repeatable.

## Endpoints

| Method | Path                                                     | Behaviour                                    |
| ------ | -------------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/lab/resource-consumption`                       | Scenario metadata + current usage.           |
| POST   | `/api/v1/lab/resource-consumption`                       | Reset dataset and quotas.                    |
| POST   | `/api/v1/lab/resource-consumption/export`                | ⚠️ Vulnerable invoice export.                |
| POST   | `/api/v1/lab/resource-consumption/secure/export`         | Hardened invoice export.                     |
| POST   | `/api/v1/lab/resource-consumption/notify`                | ⚠️ Vulnerable costly notification.           |
| POST   | `/api/v1/lab/resource-consumption/secure/notify`         | Hardened costly notification.                |

All endpoints require a valid ACME session bearer token; anonymous callers get
`401`.

Bodies: `{ "limit": number, "workFactor": number }` for export,
`{ "count": number }` for notify.

## Weaknesses demonstrated

1. **Unbounded page size.** `limit` is used verbatim — a caller can pull the
   entire dataset in one request.
2. **Client-controlled compute.** `workFactor` multiplies the simulated per-row
   enrichment cost with no ceiling.
3. **No rate limiting.** Any number of requests per second is accepted; usage is
   recorded but never enforced.
4. **Unmetered costly operation.** Each synthetic notification costs 4¢ and the
   caller may request any count, with no per-request, per-window or spend cap.

## Secure comparison

The `/secure/*` variants run the same workflow with server-owned limits:

| Control                     | Value                    |
| --------------------------- | ------------------------ |
| Max page size               | 50 rows                  |
| Max work factor             | 3                        |
| Export rate limit           | 10 requests / 60 s       |
| Compute budget              | 2 000 units / 60 s       |
| Notifications per request   | 3                        |
| Notifications per window    | 5                        |
| Spend cap                   | 200¢ / 60 s              |

Oversized values are clamped (the response reports `requestedLimit` vs.
`effectiveLimit`), and exhausted quotas return `429` with a `Retry-After`
header.

## Training UI

`/lab/resource-consumption` drives the real endpoints from the browser:
adjustable `limit`, `workFactor`, burst size and notification count; a flood
runner that reports accepted vs. throttled counts for each variant; live usage
counters; side-by-side raw HTTP panels; a reset control; and remediation
guidance.

## Remediation checklist

- Clamp client-supplied pagination server-side and return the effective value.
- Rate limit per authenticated subject (and per IP for anonymous traffic), and
  answer with `429` + `Retry-After`.
- Put a hard spend budget on every operation that costs money.
- Bound query complexity, work factors and execution time; use DB statement
  timeouts.
- Limit request body size and array lengths before doing work.
- Monitor per-caller consumption and regression-test that oversized requests are
  clamped and bursts throttled.

## Automated tests

```sh
set -a && . ./.env && set +a
python3 tests/security-labs/api4_resource_consumption_test.py
```
