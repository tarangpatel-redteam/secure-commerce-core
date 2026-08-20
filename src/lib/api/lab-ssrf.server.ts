/**
 * Phase 9 — OWASP API7:2023 Server Side Request Forgery.
 *
 * Business flow: a merchandiser imports a supplier product image by URL, and
 * the server fetches it. The vulnerable importer fetches whatever URL it is
 * given; the secure importer validates scheme, host allowlist and private
 * address ranges before fetching.
 *
 * NOTE: no real network egress happens. Requests are resolved against a
 * SIMULATED internal network so the lab is deterministic, offline and safe.
 */
import type { AppRole } from "./context.server";

export const ALLOWED_HOSTS = ["cdn.acme-supplies.test", "images.acme-partners.test"];

/** Deterministic synthetic "internet + internal network". */
const SIMULATED_NETWORK: Record<string, { status: number; contentType: string; body: string; internal: boolean }> = {
  "cdn.acme-supplies.test": {
    status: 200,
    contentType: "image/jpeg",
    body: "<binary image data: 42,118 bytes, 1200x1200 supplier photo>",
    internal: false,
  },
  "images.acme-partners.test": {
    status: 200,
    contentType: "image/png",
    body: "<binary image data: 18,004 bytes, 800x800 partner photo>",
    internal: false,
  },
  "169.254.169.254": {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      note: "SYNTHETIC cloud metadata — not a real credential",
      role: "acme-commerce-worker",
      AccessKeyId: "SYNTHETIC-AKIA-LAB-0001",
      SecretAccessKey: "SYNTHETIC-secret-do-not-use",
      Token: "SYNTHETIC-session-token",
      Expiration: "2026-12-31T23:59:59Z",
    }),
    internal: true,
  },
  "10.0.0.12": {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      service: "internal-admin-api (synthetic)",
      endpoints: ["/admin/users", "/admin/refunds", "/admin/flags"],
      auth: "trusted network — no token required",
    }),
    internal: true,
  },
  localhost: {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ service: "loopback debug console (synthetic)", debug: true }),
    internal: true,
  },
  "127.0.0.1": {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ service: "loopback debug console (synthetic)", debug: true }),
    internal: true,
  },
};

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.startsWith("[") || h === "::1") return true;
  return false;
}

export type LabSsrfFetch = {
  ok: boolean;
  mode: "vulnerable" | "secure";
  requestedUrl: string;
  resolvedHost: string | null;
  reachedInternalService: boolean;
  validationApplied: string[];
  blockedBy?: "invalid_url" | "scheme" | "private_address" | "host_not_allowlisted";
  response?: { status: number; contentType: string; body: string };
};

function lookup(host: string) {
  return SIMULATED_NETWORK[host.toLowerCase()] ?? null;
}

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API7:2023).
 * The user-supplied URL is fetched with no scheme, host or address validation.
 */
export function labSsrfVulnerableImport(rawUrl: string): LabSsrfFetch {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      mode: "vulnerable",
      requestedUrl: rawUrl,
      resolvedHost: null,
      reachedInternalService: false,
      validationApplied: [],
      blockedBy: "invalid_url",
    };
  }
  const target = lookup(url.hostname);
  return {
    ok: true,
    mode: "vulnerable",
    requestedUrl: rawUrl,
    resolvedHost: url.hostname,
    // ⚠️ No allowlist / private-range check — that omission IS the bug.
    reachedInternalService: target?.internal ?? isPrivateHost(url.hostname),
    validationApplied: [],
    response: target
      ? { status: target.status, contentType: target.contentType, body: target.body }
      : { status: 404, contentType: "text/plain", body: "simulated network: host unreachable" },
  };
}

/** Secure counterpart: scheme check, private-range denial, host allowlist. */
export function labSsrfSecureImport(rawUrl: string): LabSsrfFetch {
  const validationApplied = ["scheme_https_only", "private_address_denylist", "host_allowlist"];
  const base = { mode: "secure" as const, requestedUrl: rawUrl, validationApplied };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, ...base, resolvedHost: null, reachedInternalService: false, blockedBy: "invalid_url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, ...base, resolvedHost: url.hostname, reachedInternalService: false, blockedBy: "scheme" };
  }
  if (isPrivateHost(url.hostname)) {
    return {
      ok: false,
      ...base,
      resolvedHost: url.hostname,
      reachedInternalService: false,
      blockedBy: "private_address",
    };
  }
  if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
    return {
      ok: false,
      ...base,
      resolvedHost: url.hostname,
      reachedInternalService: false,
      blockedBy: "host_not_allowlisted",
    };
  }
  const target = lookup(url.hostname)!;
  return {
    ok: true,
    ...base,
    resolvedHost: url.hostname,
    reachedInternalService: false,
    response: { status: target.status, contentType: target.contentType, body: target.body },
  };
}

export function labSsrfScenario(caller: { userId: string; email: string; roles: AppRole[] }) {
  return {
    scenarioId: "api7-ssrf-supplier-image-import",
    vulnerability: "Server Side Request Forgery",
    owaspMapping: "API7:2023",
    description:
      "The supplier image importer fetches a merchandiser-supplied URL server-side. The vulnerable endpoint performs no validation, so the URL can be pointed at cloud metadata or internal-only services. The secure endpoint enforces HTTPS, denies private address ranges and only permits allowlisted supplier hosts. All fetches resolve against a simulated, offline network.",
    allowedHosts: ALLOWED_HOSTS,
    simulatedTargets: Object.keys(SIMULATED_NETWORK).map((host) => ({
      host,
      internal: SIMULATED_NETWORK[host]!.internal,
    })),
    samplePayloads: [
      "https://cdn.acme-supplies.test/drop/hero.jpg",
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      "http://10.0.0.12/admin/users",
      "http://localhost:8080/debug",
    ],
    caller: { userId: caller.userId, email: caller.email, roles: caller.roles },
  };
}
