/**
 * Phase 8 — OWASP API6:2023 Unrestricted Access to Sensitive Business Flows.
 *
 * Sensitive business flow: the "ACME Drop" limited flash sale. A scalper bot
 * should not be able to sweep the whole allocation, but the vulnerable
 * endpoint applies no anti-automation controls at all.
 *
 * Weakness is scoped to /api/v1/lab/bizflow/*. Production checkout is
 * unaffected.
 */
import type { AppRole } from "./context.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const LAB_BIZFLOW_SKU = "ACME-DROP-01";
export const CONTROLS = {
  maxPerRequest: 2,
  maxPerUser: 2,
  minIntervalMs: 1500,
  blockedAgentMarkers: ["curl", "python", "bot", "wget", "axios", "scrapy"],
};

type Variant = "vulnerable" | "secure";

export type LabBizflowPurchase = {
  ok: boolean;
  variant: Variant;
  requested: number;
  granted: number;
  remaining: number;
  totalOwnedByCaller: number;
  antiAutomationApplied: boolean;
  controlsApplied: string[];
  rejectedBy?: "per_request_cap" | "per_user_cap" | "bot_signature" | "velocity" | "sold_out";
};

async function stockRow(variant: Variant): Promise<number> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_bizflow_stock")
    .select("remaining")
    .eq("variant", variant)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { remaining: number } | null)?.remaining ?? 0;
}

async function ownedByUser(variant: Variant, userId: string): Promise<number> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_bizflow_purchases")
    .select("quantity, created_at")
    .eq("variant", variant)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { quantity: number; created_at: string }[];
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

async function lastPurchaseAt(variant: Variant, userId: string): Promise<number | null> {
  const supabase = await admin();
  const { data } = await supabase
    .from("lab_bizflow_purchases")
    .select("created_at")
    .eq("variant", variant)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as { created_at: string } | undefined;
  return row ? new Date(row.created_at).getTime() : null;
}

async function commit(
  variant: Variant,
  userId: string,
  quantity: number,
  signature: string,
): Promise<number> {
  const supabase = await admin();
  const remaining = await stockRow(variant);
  const granted = Math.min(quantity, remaining);
  if (granted <= 0) return 0;
  await supabase
    .from("lab_bizflow_stock")
    .update({ remaining: remaining - granted, updated_at: new Date().toISOString() })
    .eq("variant", variant);
  await supabase
    .from("lab_bizflow_purchases")
    .insert({ variant, user_id: userId, quantity: granted, client_signature: signature });
  return granted;
}

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API6:2023).
 * Authenticated, validated — but no per-user allocation cap, no request
 * quantity cap, no velocity check and no automation/bot signal inspection.
 */
export async function labBizflowVulnerableBuy(
  userId: string,
  quantity: number,
  userAgent: string,
): Promise<LabBizflowPurchase> {
  const granted = await commit("vulnerable", userId, quantity, userAgent);
  return {
    ok: granted > 0,
    variant: "vulnerable",
    requested: quantity,
    granted,
    remaining: await stockRow("vulnerable"),
    totalOwnedByCaller: await ownedByUser("vulnerable", userId),
    antiAutomationApplied: false,
    controlsApplied: [],
    ...(granted > 0 ? {} : { rejectedBy: "sold_out" as const }),
  };
}

/** Secure counterpart: same flow with business-flow abuse controls. */
export async function labBizflowSecureBuy(
  userId: string,
  quantity: number,
  userAgent: string,
): Promise<LabBizflowPurchase> {
  const controlsApplied = [
    `max_${CONTROLS.maxPerRequest}_per_request`,
    `max_${CONTROLS.maxPerUser}_per_customer`,
    `min_interval_${CONTROLS.minIntervalMs}ms`,
    "automation_signal_check",
  ];
  const base = {
    variant: "secure" as const,
    requested: quantity,
    antiAutomationApplied: true,
    controlsApplied,
  };

  const agent = userAgent.toLowerCase();
  if (!agent || CONTROLS.blockedAgentMarkers.some((marker) => agent.includes(marker))) {
    return {
      ok: false,
      ...base,
      granted: 0,
      remaining: await stockRow("secure"),
      totalOwnedByCaller: await ownedByUser("secure", userId),
      rejectedBy: "bot_signature",
    };
  }
  if (quantity > CONTROLS.maxPerRequest) {
    return {
      ok: false,
      ...base,
      granted: 0,
      remaining: await stockRow("secure"),
      totalOwnedByCaller: await ownedByUser("secure", userId),
      rejectedBy: "per_request_cap",
    };
  }
  const owned = await ownedByUser("secure", userId);
  if (owned + quantity > CONTROLS.maxPerUser) {
    return {
      ok: false,
      ...base,
      granted: 0,
      remaining: await stockRow("secure"),
      totalOwnedByCaller: owned,
      rejectedBy: "per_user_cap",
    };
  }
  const last = await lastPurchaseAt("secure", userId);
  if (last !== null && Date.now() - last < CONTROLS.minIntervalMs) {
    return {
      ok: false,
      ...base,
      granted: 0,
      remaining: await stockRow("secure"),
      totalOwnedByCaller: owned,
      rejectedBy: "velocity",
    };
  }

  const granted = await commit("secure", userId, quantity, userAgent);
  return {
    ok: granted > 0,
    ...base,
    granted,
    remaining: await stockRow("secure"),
    totalOwnedByCaller: await ownedByUser("secure", userId),
    ...(granted > 0 ? {} : { rejectedBy: "sold_out" as const }),
  };
}

export async function labBizflowReset(): Promise<void> {
  const supabase = await admin();
  const { error } = await supabase.rpc("lab_bizflow_reset");
  if (error) throw new Error(error.message);
}

export async function labBizflowScenario(caller: {
  userId: string;
  email: string;
  roles: AppRole[];
}) {
  return {
    scenarioId: "api6-sensitive-business-flow-flash-sale",
    vulnerability: "Unrestricted Access to Sensitive Business Flows",
    owaspMapping: "API6:2023",
    description:
      "The ACME Drop flash sale is a sensitive business flow. The vulnerable endpoint authenticates and validates input but applies no anti-automation controls, so a single scripted client can sweep the entire allocation. The secure endpoint enforces per-request and per-customer caps, a velocity check and automation signal inspection.",
    sku: LAB_BIZFLOW_SKU,
    controls: CONTROLS,
    stock: {
      vulnerable: await stockRow("vulnerable"),
      secure: await stockRow("secure"),
    },
    ownedByCaller: {
      vulnerable: await ownedByUser("vulnerable", caller.userId),
      secure: await ownedByUser("secure", caller.userId),
    },
    caller: { userId: caller.userId, email: caller.email, roles: caller.roles },
  };
}
