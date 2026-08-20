# API6:2023 — Unrestricted Access to Sensitive Business Flows (Phase 8)

Scenario: the "ACME Drop" limited flash sale (`ACME-DROP-01`, 25 units per
variant). Weakness scoped to `/api/v1/lab/bizflow/*`.

## Data
- `public.lab_bizflow_stock` (per-variant remaining units) and
  `public.lab_bizflow_purchases` (per-user acquisitions). RLS on, no policies
  (service role only).
- `public.lab_bizflow_reset()` restores 25 units per variant and clears
  purchases.

## Endpoints
| Method | Path | Behaviour |
| --- | --- | --- |
| GET/POST | `/api/v1/lab/bizflow` | Metadata / reset |
| POST | `/api/v1/lab/bizflow/buy` | ⚠️ No anti-automation controls |
| POST | `/api/v1/lab/bizflow/secure/buy` | Caps, velocity and bot checks |

Body: `{ "quantity": number }`. Auth required (401 otherwise).

## Weakness
The vulnerable endpoint authenticates and validates input but applies no
per-request cap, no per-customer allocation cap, no velocity limit and no
automation signal inspection — one scripted client can sweep the whole drop in
a single request.

## Secure controls
Max 2 units per request, max 2 per customer, minimum 1500 ms between purchases,
and rejection of obvious automation user agents (`curl`, `python`, `bot`, …).
Blocked attempts return `403` with the triggering control in `details.rejectedBy`.

## Remediation
Cap quantity per request and per identity/payment instrument, apply velocity
limits and device fingerprinting, add human-verification challenges on
high-demand flows, and alert on single-identity sweeps.

## UI
`/lab/bizflow` — bot burst simulator, live stock counters, raw HTTP panels, reset.
