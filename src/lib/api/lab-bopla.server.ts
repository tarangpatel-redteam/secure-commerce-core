/**
 * Server-side logic for the Broken Object Property Level Authorization lab —
 * OWASP API Security Top 10, API3:2023.
 *
 * API3 covers two sibling failures on the PROPERTY level of an object the
 * caller is otherwise allowed to touch:
 *   1. Excessive Data Exposure — the response serialises internal-only
 *      properties (risk score, support PIN, staff notes, date of birth).
 *   2. Mass Assignment — the update handler spreads the request body straight
 *      into the row, so a customer can write privileged properties
 *      (loyalty tier, store credit, VIP flag, internal risk score).
 *
 * Scope of the intentional weakness:
 *  - Only `labBoplaVulnerableGet` / `labBoplaVulnerableUpdate` are affected.
 *  - Data lives in the synthetic `lab_bopla_profiles` table. No production
 *    table, endpoint or real user data is involved.
 */
import type { AppRole } from "./context.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Properties any signed-in owner may legitimately read. */
export const PUBLIC_PROPERTIES = [
  "id",
  "userId",
  "displayName",
  "email",
  "phone",
  "marketingOptIn",
  "loyaltyTier",
  "updatedAt",
] as const;

/** Properties the client may legitimately write. Everything else is server-owned. */
export const CLIENT_WRITABLE_PROPERTIES = ["displayName", "phone", "marketingOptIn"] as const;

/** Server-owned properties. Leaking or accepting these is the vulnerability. */
export const PRIVILEGED_PROPERTIES = [
  "accountCreditCents",
  "isVip",
  "internalRiskScore",
  "internalNotes",
  "supportPin",
  "dateOfBirth",
  "loyaltyTier",
] as const;

type Row = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  marketing_opt_in: boolean;
  loyalty_tier: string;
  account_credit_cents: number;
  is_vip: boolean;
  internal_risk_score: number;
  internal_notes: string;
  support_pin: string;
  date_of_birth: string | null;
  updated_at: string;
};

const SELECT =
  "id, user_id, display_name, email, phone, marketing_opt_in, loyalty_tier, account_credit_cents, is_vip, internal_risk_score, internal_notes, support_pin, date_of_birth, updated_at";

/** ⚠️ Full serialisation, including internal-only properties. */
function toFullDto(row: Row) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in,
    loyaltyTier: row.loyalty_tier,
    accountCreditCents: row.account_credit_cents,
    isVip: row.is_vip,
    internalRiskScore: row.internal_risk_score,
    internalNotes: row.internal_notes,
    supportPin: row.support_pin,
    dateOfBirth: row.date_of_birth,
    updatedAt: row.updated_at,
  };
}

/** Safe serialisation: an explicit allowlist of caller-visible properties. */
function toSafeDto(row: Row) {
  const full = toFullDto(row);
  const safe: Record<string, unknown> = {};
  for (const key of PUBLIC_PROPERTIES) safe[key] = full[key];
  return safe;
}

export type LabBoplaProfile = ReturnType<typeof toFullDto>;

async function loadByUser(userId: string): Promise<Row | null> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_bopla_profiles")
    .select(SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

const COLUMN_BY_PROPERTY: Record<string, keyof Row> = {
  displayName: "display_name",
  phone: "phone",
  marketingOptIn: "marketing_opt_in",
  loyaltyTier: "loyalty_tier",
  accountCreditCents: "account_credit_cents",
  isVip: "is_vip",
  internalRiskScore: "internal_risk_score",
  internalNotes: "internal_notes",
  supportPin: "support_pin",
  dateOfBirth: "date_of_birth",
};

export type LabBoplaOutcome =
  | {
      ok: true;
      profile: Record<string, unknown>;
      appliedProperties: string[];
      rejectedProperties: string[];
      exposedPrivilegedProperties: string[];
    }
  | { ok: false; reason: "not_found" | "bad_request" };

/** Read of the caller's own record — ⚠️ leaks every property (Excessive Data Exposure). */
export async function labBoplaVulnerableGet(userId: string): Promise<LabBoplaOutcome> {
  const row = await loadByUser(userId);
  if (!row) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    // ⚠️ The whole DB row is serialised. No property-level filtering at all.
    profile: toFullDto(row) as unknown as Record<string, unknown>,
    appliedProperties: [],
    rejectedProperties: [],
    exposedPrivilegedProperties: [...PRIVILEGED_PROPERTIES],
  };
}

/** Secure read: explicit allowlist projection. */
export async function labBoplaSecureGet(userId: string): Promise<LabBoplaOutcome> {
  const row = await loadByUser(userId);
  if (!row) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    profile: toSafeDto(row),
    appliedProperties: [],
    rejectedProperties: [],
    exposedPrivilegedProperties: [],
  };
}

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API3:2023 — Mass Assignment).
 *
 * Every property present in the request body is mapped onto a column and
 * written, so a customer can grant themselves store credit, a VIP flag or a
 * higher loyalty tier. DO NOT copy this pattern into production code.
 */
export async function labBoplaVulnerableUpdate(
  userId: string,
  body: Record<string, unknown>,
): Promise<LabBoplaOutcome> {
  const row = await loadByUser(userId);
  if (!row) return { ok: false, reason: "not_found" };

  const patch: Record<string, unknown> = {};
  const applied: string[] = [];
  // ⚠️ No allowlist: whatever the client sends is written.
  for (const [key, value] of Object.entries(body)) {
    const column = COLUMN_BY_PROPERTY[key];
    if (!column) continue;
    patch[column] = value;
    applied.push(key);
  }
  if (applied.length === 0) return { ok: false, reason: "bad_request" };

  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_bopla_profiles")
    .update(patch)
    .eq("user_id", userId)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);

  return {
    ok: true,
    profile: toFullDto(data as Row) as unknown as Record<string, unknown>,
    appliedProperties: applied,
    rejectedProperties: [],
    exposedPrivilegedProperties: [...PRIVILEGED_PROPERTIES],
  };
}

/**
 * Secure counterpart: a strict write allowlist plus an allowlisted response
 * projection. Privileged properties are ignored and reported back, never
 * written and never serialised.
 */
export async function labBoplaSecureUpdate(
  userId: string,
  body: Record<string, unknown>,
): Promise<LabBoplaOutcome> {
  const row = await loadByUser(userId);
  if (!row) return { ok: false, reason: "not_found" };

  const writable = new Set<string>(CLIENT_WRITABLE_PROPERTIES);
  const patch: Record<string, unknown> = {};
  const applied: string[] = [];
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!writable.has(key)) {
      rejected.push(key);
      continue;
    }
    if (key === "displayName" && typeof value === "string") {
      patch["display_name"] = value.trim().slice(0, 120);
      applied.push(key);
    } else if (key === "phone" && typeof value === "string") {
      patch["phone"] = value.trim().slice(0, 32);
      applied.push(key);
    } else if (key === "marketingOptIn" && typeof value === "boolean") {
      patch["marketing_opt_in"] = value;
      applied.push(key);
    } else {
      rejected.push(key);
    }
  }

  if (applied.length === 0) {
    return {
      ok: true,
      profile: toSafeDto(row),
      appliedProperties: [],
      rejectedProperties: rejected,
      exposedPrivilegedProperties: [],
    };
  }

  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_bopla_profiles")
    .update(patch)
    .eq("user_id", userId)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);

  return {
    ok: true,
    profile: toSafeDto(data as Row),
    appliedProperties: applied,
    rejectedProperties: rejected,
    exposedPrivilegedProperties: [],
  };
}

/** Rebuilds the deterministic lab records for Customer-A and Customer-B. */
export async function labBoplaReset(): Promise<Record<string, unknown>> {
  const supabase = await admin();
  const { data, error } = await supabase.rpc("lab_bopla_reset");
  if (error) throw new Error(error.message);
  return data as unknown as Record<string, unknown>;
}

export type LabBoplaScenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  publicProperties: readonly string[];
  clientWritableProperties: readonly string[];
  privilegedProperties: readonly string[];
  users: { label: string; email: string; role: AppRole }[];
  caller: { userId: string; email: string; roles: AppRole[] };
  hasLabRecord: boolean;
};

/** Scenario metadata. Safe to expose: no passwords, tokens or secrets. */
export async function labBoplaScenario(caller: {
  userId: string;
  email: string;
  roles: AppRole[];
}): Promise<LabBoplaScenario> {
  const row = await loadByUser(caller.userId);
  return {
    scenarioId: "api3-bopla-customer-profile",
    vulnerability: "Broken Object Property Level Authorization",
    owaspMapping: "API3:2023",
    description:
      "The lab profile object mixes customer-editable properties with server-owned ones. The vulnerable endpoints serialise the entire row back to the caller (excessive data exposure) and write every property the client sends (mass assignment), so a customer can read internal notes and grant themselves store credit or VIP status.",
    publicProperties: PUBLIC_PROPERTIES,
    clientWritableProperties: CLIENT_WRITABLE_PROPERTIES,
    privilegedProperties: PRIVILEGED_PROPERTIES,
    users: [
      { label: "Customer-A", email: "customer.a@acme-commerce.test", role: "customer" },
      { label: "Customer-B", email: "customer.b@acme-commerce.test", role: "customer" },
    ],
    caller: { userId: caller.userId, email: caller.email, roles: caller.roles },
    hasLabRecord: row !== null,
  };
}
