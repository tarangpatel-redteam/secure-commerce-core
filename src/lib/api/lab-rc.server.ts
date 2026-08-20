/**
 * Server-side logic for the Unrestricted Resource Consumption lab —
 * OWASP API Security Top 10, API4:2023 (Phase 7).
 *
 * Two synthetic workflows are exposed twice each, once without and once with
 * consumption controls:
 *
 *   1. Invoice export  — a paginated report over `lab_rc_records`.
 *      ⚠️ Vulnerable: the client-supplied `limit` and `workFactor` are used
 *      verbatim, there is no page-size ceiling and no request rate limit, so a
 *      single caller can pull the entire dataset repeatedly and drive
 *      unbounded server compute.
 *      ✅ Secure: page-size ceiling, work-factor ceiling, per-caller sliding
 *      window rate limit and a compute budget.
 *
 *   2. Recovery-code notification — each send costs the business real money.
 *      ⚠️ Vulnerable: unlimited sends per request and per window, no spend cap.
 *      ✅ Secure: per-request cap, per-window cap and a hard currency budget.
 *
 * Scope: only `/api/v1/lab/resource-consumption/*` is affected. All data lives
 * in the synthetic `lab_rc_records` / `lab_rc_usage` tables. No production
 * endpoint, table or real customer record is involved.
 */
import type { AppRole } from "./context.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Secure-variant consumption controls (the vulnerable variant applies none). */
export const CONTROLS = {
  /** Maximum rows a single secure export may return. */
  maxPageSize: 50,
  /** Maximum "enrichment passes" a secure export may request. */
  maxWorkFactor: 3,
  /** Sliding window length for the secure rate limiter, in seconds. */
  windowSeconds: 60,
  /** Maximum secure export requests per window, per caller. */
  maxExportRequestsPerWindow: 10,
  /** Maximum simulated compute units per window, per caller. */
  maxComputeUnitsPerWindow: 2_000,
  /** Maximum notifications a single secure request may send. */
  maxNotificationsPerRequest: 3,
  /** Maximum notifications per window, per caller. */
  maxNotificationsPerWindow: 5,
  /** Hard spend ceiling per window, per caller (synthetic currency). */
  maxBudgetCentsPerWindow: 200,
  /** Cost of one synthetic notification. */
  notificationCostCents: 4,
} as const;

export const DATASET_SIZE = 500;

export type LabRcVariant = "vulnerable" | "secure";

type UsageRow = {
  id: string;
  user_id: string;
  variant: string;
  window_started_at: string;
  request_count: number;
  rows_returned: number;
  compute_units: number;
  notifications_sent: number;
  budget_spent_cents: number;
};

export type LabRcUsage = {
  variant: LabRcVariant;
  windowStartedAt: string;
  windowSecondsRemaining: number;
  requestCount: number;
  rowsReturned: number;
  computeUnits: number;
  notificationsSent: number;
  budgetSpentCents: number;
};

function toUsageDto(row: UsageRow): LabRcUsage {
  const started = new Date(row.window_started_at).getTime();
  const elapsed = Math.floor((Date.now() - started) / 1000);
  return {
    variant: row.variant as LabRcVariant,
    windowStartedAt: row.window_started_at,
    windowSecondsRemaining: Math.max(0, CONTROLS.windowSeconds - elapsed),
    requestCount: row.request_count,
    rowsReturned: row.rows_returned,
    computeUnits: row.compute_units,
    notificationsSent: row.notifications_sent,
    budgetSpentCents: row.budget_spent_cents,
  };
}

const USAGE_SELECT =
  "id, user_id, variant, window_started_at, request_count, rows_returned, compute_units, notifications_sent, budget_spent_cents";

/**
 * Loads (or creates) the caller's usage row for a variant.
 *
 * `rolling` = true resets the counters when the sliding window has elapsed;
 * only the secure variant needs that, but both variants use the same storage
 * so the lab UI can compare the recorded consumption side by side.
 */
async function loadUsage(userId: string, variant: LabRcVariant, rolling: boolean) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_rc_usage")
    .select(USAGE_SELECT)
    .eq("user_id", userId)
    .eq("variant", variant)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from("lab_rc_usage")
      .insert({ user_id: userId, variant } as never)
      .select(USAGE_SELECT)
      .single();
    if (insertError) throw new Error(insertError.message);
    return created as UsageRow;
  }

  const row = data as UsageRow;
  const elapsed = (Date.now() - new Date(row.window_started_at).getTime()) / 1000;
  if (rolling && elapsed >= CONTROLS.windowSeconds) {
    const { data: rolled, error: rollError } = await supabase
      .from("lab_rc_usage")
      .update({
        window_started_at: new Date().toISOString(),
        request_count: 0,
        rows_returned: 0,
        compute_units: 0,
        notifications_sent: 0,
        budget_spent_cents: 0,
      } as never)
      .eq("id", row.id)
      .select(USAGE_SELECT)
      .single();
    if (rollError) throw new Error(rollError.message);
    return rolled as UsageRow;
  }

  return row;
}

async function recordUsage(
  row: UsageRow,
  delta: Partial<Pick<UsageRow, "request_count" | "rows_returned" | "compute_units" | "notifications_sent" | "budget_spent_cents">>,
) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_rc_usage")
    .update({
      request_count: row.request_count + (delta.request_count ?? 0),
      rows_returned: row.rows_returned + (delta.rows_returned ?? 0),
      compute_units: row.compute_units + (delta.compute_units ?? 0),
      notifications_sent: row.notifications_sent + (delta.notifications_sent ?? 0),
      budget_spent_cents: row.budget_spent_cents + (delta.budget_spent_cents ?? 0),
    } as never)
    .eq("id", row.id)
    .select(USAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return toUsageDto(data as UsageRow);
}

type RecordRow = {
  seq: number;
  reference: string;
  customer_label: string;
  region: string;
  amount_cents: number;
  issued_on: string;
};

async function fetchRecords(limit: number) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_rc_records")
    .select("seq, reference, customer_label, region, amount_cents, issued_on")
    .order("seq", { ascending: true })
    .limit(Math.max(1, Math.min(limit, DATASET_SIZE)));
  if (error) throw new Error(error.message);
  return (data ?? []) as RecordRow[];
}

/** Simulated per-row enrichment cost; keeps the lab cheap but measurable. */
function computeCost(rows: number, workFactor: number) {
  return rows * workFactor;
}

export type LabRcExportInput = { limit: number; workFactor: number };

export type LabRcExportResult =
  | {
      ok: true;
      requestedLimit: number;
      requestedWorkFactor: number;
      effectiveLimit: number;
      effectiveWorkFactor: number;
      rowsReturned: number;
      computeUnits: number;
      durationMs: number;
      controlsApplied: string[];
      rows: RecordRow[];
      usage: LabRcUsage;
    }
  | {
      ok: false;
      reason: "rate_limited" | "compute_budget_exceeded";
      retryAfterSeconds: number;
      usage: LabRcUsage;
    };

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API4:2023 — Unrestricted Resource Consumption).
 *
 * The client fully controls how much work the server performs: `limit` has no
 * ceiling and `workFactor` multiplies the simulated per-row cost. There is no
 * rate limit, no compute budget and no timeout. DO NOT copy this pattern.
 */
export async function labRcVulnerableExport(
  userId: string,
  input: LabRcExportInput,
): Promise<LabRcExportResult> {
  const started = Date.now();
  const usageRow = await loadUsage(userId, "vulnerable", false);

  // ⚠️ No clamping: whatever the caller asks for is what the server attempts.
  const rows = await fetchRecords(input.limit);
  const computeUnits = computeCost(input.limit, input.workFactor);

  const usage = await recordUsage(usageRow, {
    request_count: 1,
    rows_returned: rows.length,
    compute_units: computeUnits,
  });

  return {
    ok: true,
    requestedLimit: input.limit,
    requestedWorkFactor: input.workFactor,
    effectiveLimit: input.limit,
    effectiveWorkFactor: input.workFactor,
    rowsReturned: rows.length,
    computeUnits,
    durationMs: Date.now() - started,
    controlsApplied: [],
    rows,
    usage,
  };
}

/**
 * Secure counterpart: page-size ceiling, work-factor ceiling, per-caller
 * sliding-window rate limit and a per-window compute budget.
 */
export async function labRcSecureExport(
  userId: string,
  input: LabRcExportInput,
): Promise<LabRcExportResult> {
  const started = Date.now();
  const usageRow = await loadUsage(userId, "secure", true);
  const elapsed = Math.floor((Date.now() - new Date(usageRow.window_started_at).getTime()) / 1000);
  const retryAfterSeconds = Math.max(1, CONTROLS.windowSeconds - elapsed);

  if (usageRow.request_count >= CONTROLS.maxExportRequestsPerWindow) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds,
      usage: toUsageDto(usageRow),
    };
  }

  const effectiveLimit = Math.max(1, Math.min(input.limit, CONTROLS.maxPageSize));
  const effectiveWorkFactor = Math.max(1, Math.min(input.workFactor, CONTROLS.maxWorkFactor));
  const computeUnits = computeCost(effectiveLimit, effectiveWorkFactor);

  if (usageRow.compute_units + computeUnits > CONTROLS.maxComputeUnitsPerWindow) {
    return {
      ok: false,
      reason: "compute_budget_exceeded",
      retryAfterSeconds,
      usage: toUsageDto(usageRow),
    };
  }

  const rows = await fetchRecords(effectiveLimit);
  const usage = await recordUsage(usageRow, {
    request_count: 1,
    rows_returned: rows.length,
    compute_units: computeUnits,
  });

  return {
    ok: true,
    requestedLimit: input.limit,
    requestedWorkFactor: input.workFactor,
    effectiveLimit,
    effectiveWorkFactor,
    rowsReturned: rows.length,
    computeUnits,
    durationMs: Date.now() - started,
    controlsApplied: [
      `page_size_max_${CONTROLS.maxPageSize}`,
      `work_factor_max_${CONTROLS.maxWorkFactor}`,
      `rate_limit_${CONTROLS.maxExportRequestsPerWindow}_per_${CONTROLS.windowSeconds}s`,
      `compute_budget_${CONTROLS.maxComputeUnitsPerWindow}_units`,
    ],
    rows,
    usage,
  };
}

export type LabRcNotifyResult =
  | {
      ok: true;
      requestedCount: number;
      sentCount: number;
      costCents: number;
      controlsApplied: string[];
      usage: LabRcUsage;
    }
  | {
      ok: false;
      reason: "rate_limited" | "budget_exceeded";
      retryAfterSeconds: number;
      usage: LabRcUsage;
    };

/**
 * ⚠️ INTENTIONALLY VULNERABLE — an unmetered, money-spending operation.
 * Each "SMS" costs the business money and the caller may request any number,
 * as often as they like.
 */
export async function labRcVulnerableNotify(
  userId: string,
  count: number,
): Promise<LabRcNotifyResult> {
  const usageRow = await loadUsage(userId, "vulnerable", false);
  const costCents = count * CONTROLS.notificationCostCents;
  const usage = await recordUsage(usageRow, {
    request_count: 1,
    notifications_sent: count,
    budget_spent_cents: costCents,
  });
  return {
    ok: true,
    requestedCount: count,
    sentCount: count,
    costCents,
    controlsApplied: [],
    usage,
  };
}

/** Secure counterpart: per-request cap, per-window cap and a spend ceiling. */
export async function labRcSecureNotify(
  userId: string,
  count: number,
): Promise<LabRcNotifyResult> {
  const usageRow = await loadUsage(userId, "secure", true);
  const elapsed = Math.floor((Date.now() - new Date(usageRow.window_started_at).getTime()) / 1000);
  const retryAfterSeconds = Math.max(1, CONTROLS.windowSeconds - elapsed);

  if (usageRow.notifications_sent >= CONTROLS.maxNotificationsPerWindow) {
    return { ok: false, reason: "rate_limited", retryAfterSeconds, usage: toUsageDto(usageRow) };
  }

  const perRequest = Math.min(count, CONTROLS.maxNotificationsPerRequest);
  const remainingWindow = CONTROLS.maxNotificationsPerWindow - usageRow.notifications_sent;
  const sentCount = Math.max(0, Math.min(perRequest, remainingWindow));
  const costCents = sentCount * CONTROLS.notificationCostCents;

  if (usageRow.budget_spent_cents + costCents > CONTROLS.maxBudgetCentsPerWindow) {
    return { ok: false, reason: "budget_exceeded", retryAfterSeconds, usage: toUsageDto(usageRow) };
  }

  const usage = await recordUsage(usageRow, {
    request_count: 1,
    notifications_sent: sentCount,
    budget_spent_cents: costCents,
  });

  return {
    ok: true,
    requestedCount: count,
    sentCount,
    costCents,
    controlsApplied: [
      `per_request_max_${CONTROLS.maxNotificationsPerRequest}`,
      `per_window_max_${CONTROLS.maxNotificationsPerWindow}`,
      `spend_cap_${CONTROLS.maxBudgetCentsPerWindow}_cents`,
    ],
    usage,
  };
}

/** Rebuilds the deterministic dataset and clears every usage counter. */
export async function labRcReset(): Promise<Record<string, unknown>> {
  const supabase = await admin();
  const { data, error } = await supabase.rpc("lab_rc_reset");
  if (error) throw new Error(error.message);
  return data as unknown as Record<string, unknown>;
}

export type LabRcScenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  datasetSize: number;
  controls: typeof CONTROLS;
  caller: { userId: string; email: string; roles: AppRole[] };
  usage: { vulnerable: LabRcUsage; secure: LabRcUsage };
};

/** Scenario metadata. Contains no secrets, credentials or real customer data. */
export async function labRcScenario(caller: {
  userId: string;
  email: string;
  roles: AppRole[];
}): Promise<LabRcScenario> {
  const vulnerable = await loadUsage(caller.userId, "vulnerable", false);
  const secure = await loadUsage(caller.userId, "secure", true);
  return {
    scenarioId: "api4-unrestricted-resource-consumption-invoice-export",
    vulnerability: "Unrestricted Resource Consumption",
    owaspMapping: "API4:2023",
    description:
      "The synthetic invoice-export endpoint lets the caller choose the page size and a per-row work factor with no ceiling, applies no rate limit and keeps no compute budget. A sibling notification endpoint spends synthetic money per call with no cap, so a single authenticated client can exhaust both compute and budget.",
    datasetSize: DATASET_SIZE,
    controls: CONTROLS,
    caller: { userId: caller.userId, email: caller.email, roles: caller.roles },
    usage: { vulnerable: toUsageDto(vulnerable), secure: toUsageDto(secure) },
  };
}
