# API7:2023 — Server Side Request Forgery (Phase 9)

Scenario: a supplier catalogue image importer that fetches a merchant-supplied
URL server-side. Weakness scoped to `/api/v1/lab/ssrf/*`.

## Data
Fully deterministic: `SIMULATED_NETWORK` in `src/lib/api/lab-ssrf.server.ts`
maps synthetic hosts (public CDN, `169.254.169.254` metadata service,
`10.0.0.12` internal admin, `127.0.0.1` local ops) to canned responses. No real
network egress ever happens.

## Endpoints
| Method | Path | Behaviour |
| --- | --- | --- |
| GET/POST | `/api/v1/lab/ssrf` | Metadata / reset (stateless) |
| POST | `/api/v1/lab/ssrf/import` | ⚠️ Fetches any URL supplied |
| POST | `/api/v1/lab/ssrf/secure/import` | Scheme + host allowlist, private-range block |

Body: `{ "url": string }`. Auth required.

## Weakness
The vulnerable importer accepts any scheme and host, so the caller can pivot the
server into the simulated internal network and read cloud metadata credentials
and an internal admin panel.

## Secure controls
HTTPS only, host allowlist (`cdn.acme-suppliers.example`,
`images.acme-suppliers.example`), rejection of loopback/private/link-local
addresses, no redirect following, timeout and response-size ceilings.

## Remediation
Allowlist destinations, resolve and validate IPs (re-validating after
redirects), disable redirects, and run outbound fetches from an
egress-restricted segment with no metadata access.

## UI
`/lab/ssrf` — URL field with sample payloads and side-by-side raw HTTP panels.
