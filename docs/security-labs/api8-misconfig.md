# API8:2023 — Security Misconfiguration (Phase 10)

Scenario: a diagnostics endpoint accidentally shipped with debug mode enabled.
Weakness scoped to `/api/v1/lab/misconfig/*`.

## Data
Stateless and deterministic: synthetic configuration, fake secret material and
a canned stack trace defined in `src/lib/api/lab-misconfig.server.ts`. No real
credentials are involved.

## Endpoints
| Method | Path | Behaviour |
| --- | --- | --- |
| GET/POST | `/api/v1/lab/misconfig` | Metadata / reset (stateless) |
| POST | `/api/v1/lab/misconfig/diagnostics` | ⚠️ Debug mode: leaks config, secrets, stack traces; wildcard CORS + credentials; no hardening headers |
| POST | `/api/v1/lab/misconfig/secure/diagnostics` | Generic response, correlation id only, strict headers |

Body: `{ "probe": "diagnostics" | "error" | "headers" }`. Auth required.

## Weakness
Verbose errors, environment dumps and permissive CORS give an attacker a map of
the deployment plus reusable secret-shaped material.

## Secure controls
Debug output disabled, generic error bodies with a correlation id, restricted
CORS origin, and HSTS / CSP / `X-Content-Type-Options` / `X-Frame-Options` /
Referrer-Policy / Permissions-Policy headers, with server banners removed.

## Remediation
Disable debug endpoints outside development, log details server-side only,
lock CORS to known origins, ship hardening headers by default and verify
configuration in CI.

## UI
`/lab/misconfig` — probe selector with response **headers** and bodies rendered
side by side.
