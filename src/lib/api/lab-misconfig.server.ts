/**
 * Phase 10 — OWASP API8:2023 Security Misconfiguration.
 *
 * Business flow: a diagnostics endpoint left enabled in a production-like
 * environment. The vulnerable variant leaks stack traces, configuration and
 * synthetic secret material, ships permissive CORS and omits security
 * headers. The secure variant returns a correlation id only, with strict
 * headers and same-origin CORS.
 *
 * All configuration values below are SYNTHETIC lab strings — no real secrets.
 */
import type { AppRole } from "./context.server";

export const VULNERABLE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  // ⚠️ Reflective wildcard CORS with credentials, verbose stack banner and
  // no hardening headers. This IS the misconfiguration.
  "access-control-allow-origin": "*",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "x-powered-by": "acme-commerce/2.4.1 (node 22.6.0, tanstack-start 1.x)",
  "x-debug-mode": "enabled",
  "server": "acme-edge/1.11.3",
};

export const SECURE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
};

const SYNTHETIC_CONFIG = {
  environment: "production",
  debug: true,
  databaseUrl: "postgres://acme_app:SYNTHETIC-db-password@db.internal.acme:5432/acme_commerce",
  serviceRoleKey: "SYNTHETIC-service-role-key-lab-only",
  paymentsWebhookSecret: "SYNTHETIC-whsec-lab-only",
  adminBootstrapToken: "SYNTHETIC-admin-bootstrap-token",
  featureFlags: { labMode: true, verboseErrors: true, directoryListing: true },
};

const SYNTHETIC_STACK = [
  "Error: order lookup failed for tenant acme-prod",
  "    at loadOrder (/srv/acme/src/lib/api/orders.server.ts:118:11)",
  "    at OrderController.show (/srv/acme/src/routes/api/v1/orders/$id.ts:44:22)",
  "    at runHandler (/srv/acme/node_modules/@tanstack/start-server-core/dist/handler.js:301:16)",
].join("\n");

export type LabMisconfigProbe = "diagnostics" | "error" | "headers";

export type LabMisconfigResult = {
  mode: "vulnerable" | "secure";
  probe: LabMisconfigProbe;
  findings: string[];
  headersReturned: Record<string, string>;
  payload: unknown;
};

/** ⚠️ INTENTIONALLY VULNERABLE (API8:2023). */
export function labMisconfigVulnerable(
  probe: LabMisconfigProbe,
  caller: { userId: string; email: string; roles: AppRole[] },
): LabMisconfigResult {
  const findings = [
    "debug_endpoint_enabled_in_production",
    "verbose_stack_traces_returned_to_client",
    "configuration_and_secret_material_exposed",
    "wildcard_cors_with_credentials",
    "missing_security_headers",
    "server_and_framework_versions_disclosed",
  ];
  const payload =
    probe === "error"
      ? {
          message: "Unhandled exception while loading order",
          stack: SYNTHETIC_STACK,
          query: "select * from orders where id = '\"><script>' -- raw SQL echoed back",
          sessionUser: caller,
        }
      : probe === "headers"
        ? { note: "Inspect the response headers panel", headers: VULNERABLE_HEADERS }
        : {
            uptimeSeconds: 918273,
            config: SYNTHETIC_CONFIG,
            routes: ["/api/v1/*", "/api/v1/lab/*", "/__debug", "/__debug/env"],
            sessionUser: caller,
          };
  return { mode: "vulnerable", probe, findings, headersReturned: VULNERABLE_HEADERS, payload };
}

/** Secure counterpart: hardened headers, no internals, correlation id only. */
export function labMisconfigSecure(probe: LabMisconfigProbe): LabMisconfigResult {
  return {
    mode: "secure",
    probe,
    findings: [
      "debug_endpoint_disabled",
      "generic_error_with_correlation_id",
      "no_configuration_disclosure",
      "same_origin_cors",
      "security_headers_present",
    ],
    headersReturned: SECURE_HEADERS,
    payload: {
      message: probe === "error" ? "Something went wrong. Reference this id with support." : "ok",
      correlationId: `req_${Math.random().toString(36).slice(2, 12)}`,
    },
  };
}

export function labMisconfigScenario(caller: { userId: string; email: string; roles: AppRole[] }) {
  return {
    scenarioId: "api8-security-misconfiguration-diagnostics",
    vulnerability: "Security Misconfiguration",
    owaspMapping: "API8:2023",
    description:
      "A diagnostics endpoint was shipped with debug mode on. It returns stack traces, environment configuration and synthetic secret material, advertises framework versions, allows any origin with credentials, and omits hardening headers. The secure variant returns a correlation id with strict headers.",
    probes: ["diagnostics", "error", "headers"] satisfies LabMisconfigProbe[],
    vulnerableHeaders: VULNERABLE_HEADERS,
    secureHeaders: SECURE_HEADERS,
    caller: { userId: caller.userId, email: caller.email, roles: caller.roles },
  };
}
