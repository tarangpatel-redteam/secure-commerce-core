/**
 * Server-side logic for the Broken Function Level Authorization (BFLA) lab —
 * OWASP API Security Top 10, API5:2023.
 *
 * The privileged FUNCTION under test is "transition an order's fulfilment
 * status", which in a real store belongs to warehouse/support staff only.
 *
 * Scope of the intentional weakness:
 *  - Only `labBflaVulnerableSetStatus` skips the role check.
 *  - Production endpoints are unaffected. There is no production status
 *    endpoint; customers can only reach `POST /api/v1/orders/:id/cancel`,
 *    which stays owner-scoped and status-restricted.
 */
import type { AppRole } from "./context.server";
import type { OrderStatus } from "./orders.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const LAB_BFLA_ORDER_NUMBER = "LAB-BFLA-A1";

/** Statuses the lab allows as a target of the privileged function. */
export const LAB_BFLA_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export const STAFF_ROLES: AppRole[] = ["employee", "manager", "administrator"];

export function isStaff(roles: AppRole[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

export type LabBflaOrderDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  ownerUserId: string;
  ownerEmail: string | null;
  totalCents: number;
  currency: string;
  updatedAt: string;
};

type Row = {
  id: string;
  order_number: string;
  status: OrderStatus;
  user_id: string;
  total_cents: number;
  currency: string;
  updated_at: string;
};

async function loadOrder(orderId: string): Promise<Row | null> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, user_id, total_cents, currency, updated_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

async function ownerEmail(userId: string): Promise<string | null> {
  const supabase = await admin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

async function toDto(row: Row): Promise<LabBflaOrderDto> {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    ownerUserId: row.user_id,
    ownerEmail: await ownerEmail(row.user_id),
    totalCents: row.total_cents,
    currency: row.currency,
    updatedAt: row.updated_at,
  };
}

async function applyStatus(orderId: string, status: OrderStatus): Promise<Row> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id, order_number, status, user_id, total_cents, currency, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Row;
}

export type LabBflaOutcome =
  | { ok: true; order: LabBflaOrderDto; previousStatus: OrderStatus }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API5:2023 — BFLA).
 *
 * This is an administrative function: only staff should be able to move an
 * order through fulfilment. The handler authenticates the caller, but there
 * is no role/function-level authorization check at all, so an ordinary
 * customer can invoke a staff-only operation simply by knowing the route.
 *
 * DO NOT copy this pattern into production code.
 */
export async function labBflaVulnerableSetStatus(
  orderId: string,
  status: OrderStatus,
): Promise<LabBflaOutcome> {
  const row = await loadOrder(orderId);
  if (!row) return { ok: false, reason: "not_found" };
  // ⚠️ No `isStaff(caller.roles)` check here — that omission IS the vulnerability.
  const updated = await applyStatus(orderId, status);
  return { ok: true, order: await toDto(updated), previousStatus: row.status };
}

/**
 * Secure counterpart: identical work, preceded by an explicit deny-by-default
 * function-level authorization check derived from the verified session.
 */
export async function labBflaSecureSetStatus(
  orderId: string,
  status: OrderStatus,
  callerRoles: AppRole[],
): Promise<LabBflaOutcome> {
  if (!isStaff(callerRoles)) return { ok: false, reason: "forbidden" };
  const row = await loadOrder(orderId);
  if (!row) return { ok: false, reason: "not_found" };
  const updated = await applyStatus(orderId, status);
  return { ok: true, order: await toDto(updated), previousStatus: row.status };
}

/** Rebuilds the deterministic lab order (status back to `paid`). */
export async function labBflaReset(): Promise<{ labOrderId: string }> {
  const supabase = await admin();
  const { data, error } = await supabase.rpc("lab_bfla_reset");
  if (error) throw new Error(error.message);
  return data as unknown as { labOrderId: string };
}

export type LabBflaScenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  privilegedFunction: string;
  allowedStatuses: readonly OrderStatus[];
  staffRoles: AppRole[];
  users: { label: string; email: string; role: AppRole }[];
  labOrder: LabBflaOrderDto | null;
  caller: { userId: string; email: string; roles: AppRole[]; isStaff: boolean };
};

/** Scenario metadata. Safe to expose: no passwords, tokens or secrets. */
export async function labBflaScenario(caller: {
  userId: string;
  email: string;
  roles: AppRole[];
}): Promise<LabBflaScenario> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, user_id, total_cents, currency, updated_at")
    .eq("order_number", LAB_BFLA_ORDER_NUMBER)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    scenarioId: "api5-bfla-order-status",
    vulnerability: "Broken Function Level Authorization",
    owaspMapping: "API5:2023",
    description:
      "Changing an order's fulfilment status is a staff-only function. The vulnerable endpoint authenticates the caller but never checks their role, so an ordinary customer can invoke the administrative operation and drive an order through fulfilment.",
    privilegedFunction: "order.status.transition",
    allowedStatuses: LAB_BFLA_STATUSES,
    staffRoles: STAFF_ROLES,
    users: [
      { label: "Customer-A", email: "customer.a@acme-commerce.test", role: "customer" },
      { label: "Employee-A", email: "employee.a@acme-commerce.test", role: "employee" },
      { label: "Manager-A", email: "manager.a@acme-commerce.test", role: "manager" },
    ],
    labOrder: data ? await toDto(data as Row) : null,
    caller: {
      userId: caller.userId,
      email: caller.email,
      roles: caller.roles,
      isStaff: isStaff(caller.roles),
    },
  };
}
