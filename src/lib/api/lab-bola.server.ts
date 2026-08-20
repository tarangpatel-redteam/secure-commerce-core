/**
 * Server-side data access for the Broken Object Level Authorization (BOLA)
 * lab. This module is INTENTIONALLY split into a vulnerable path and a secure
 * path so trainees can see the exact difference between authentication and
 * object-level authorization.
 *
 * Scope of the intentional weakness:
 *  - Only functions in this file that are exported as `labBolaVulnerable*`
 *    intentionally skip the ownership check.
 *  - The production endpoints under /api/v1/orders/* are unaffected: they
 *    query through the caller's RLS-scoped Supabase client and still deny
 *    cross-account reads.
 */
import type { OrderDetailDto } from "./orders.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ORDER_COLUMNS =
  "id, user_id, order_number, status, subtotal_cents, shipping_cents, tax_cents, total_cents, currency, created_at, shipping_address_snapshot, order_items(id, product_id, product_name_snapshot, product_slug_snapshot, unit_price_cents, quantity, line_total_cents), payments(status, provider, provider_reference, amount_cents, created_at)";

type Row = {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderDetailDto["status"];
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  shipping_address_snapshot: OrderDetailDto["shippingAddress"];
  order_items: {
    id: string;
    product_id: string | null;
    product_name_snapshot: string;
    product_slug_snapshot: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }[];
  payments: {
    status: "pending" | "succeeded" | "failed";
    provider: string;
    provider_reference: string;
    amount_cents: number;
    created_at: string;
  }[];
};

export type LabOrderDto = OrderDetailDto & { ownerUserId: string };

function toDto(row: Row): LabOrderDto {
  const items = row.order_items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name_snapshot,
    productSlug: item.product_slug_snapshot,
    unitPriceCents: item.unit_price_cents,
    quantity: item.quantity,
    lineTotalCents: item.line_total_cents,
  }));
  const payment = [...row.payments].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  return {
    id: row.id,
    ownerUserId: row.user_id,
    orderNumber: row.order_number,
    status: row.status,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    createdAt: row.created_at,
    items,
    shippingAddress: row.shipping_address_snapshot ?? {},
    payment: payment
      ? {
          status: payment.status,
          provider: payment.provider,
          providerReference: payment.provider_reference,
          amountCents: payment.amount_cents,
          createdAt: payment.created_at,
        }
      : null,
  };
}

/**
 * INTENTIONALLY VULNERABLE (API1:2023 — BOLA).
 *
 * The caller is authenticated at the endpoint layer, but this function looks
 * the order up with the service-role client and returns whatever it finds.
 * There is no `order.user_id === caller.userId` check, so any authenticated
 * user can read any order by guessing / observing its id.
 *
 * DO NOT copy this pattern into production code — it is here so trainees can
 * observe how BOLA looks in a realistic-looking data-access helper.
 */
export async function labBolaVulnerableGetOrder(orderId: string): Promise<LabOrderDto | null> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toDto(data as unknown as Row);
}

/**
 * Secure counterpart used by the side-by-side comparison in the lab UI.
 * Performs an explicit ownership check after the object lookup and denies
 * cross-account access.
 */
export async function labBolaSecureGetOrder(
  orderId: string,
  callerUserId: string,
): Promise<{ ok: true; order: LabOrderDto } | { ok: false; reason: "forbidden" | "not_found" }> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false, reason: "not_found" };
  const dto = toDto(data as unknown as Row);
  if (dto.ownerUserId !== callerUserId) return { ok: false, reason: "forbidden" };
  return { ok: true, order: dto };
}

/** Rebuilds deterministic lab orders for Customer-A and Customer-B. */
export async function labBolaReset(): Promise<{
  customerAOrderId: string;
  customerBOrderId: string;
}> {
  const supabase = await admin();
  const { data, error } = await supabase.rpc("lab_bola_reset");
  if (error) throw new Error(error.message);
  return data as { customerAOrderId: string; customerBOrderId: string };
}

export type LabUser = {
  label: string;
  email: string;
  userId: string;
  orderId: string;
  orderNumber: string;
};

/** Scenario metadata: safe to expose (no passwords, no tokens, no PII). */
export async function labBolaScenario(): Promise<{
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  users: LabUser[];
}> {
  const supabase = await admin();
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("email", ["customer.a@acme-commerce.test", "customer.b@acme-commerce.test"]);
  if (usersError) throw new Error(usersError.message);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, user_id, order_number")
    .in("order_number", ["LAB-BOLA-A1", "LAB-BOLA-B1"]);
  if (ordersError) throw new Error(ordersError.message);

  const labels: Record<string, string> = {
    "customer.a@acme-commerce.test": "Customer-A",
    "customer.b@acme-commerce.test": "Customer-B",
  };

  const lab: LabUser[] = (users ?? [])
    .map((u) => {
      const order = (orders ?? []).find((o) => o.user_id === u.id);
      if (!order) return null;
      return {
        label: labels[u.email] ?? u.email,
        email: u.email,
        userId: u.id,
        orderId: order.id,
        orderNumber: order.order_number,
      };
    })
    .filter((v): v is LabUser => v !== null)
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    scenarioId: "api1-bola-orders",
    vulnerability: "Broken Object Level Authorization",
    owaspMapping: "API1:2023",
    description:
      "The vulnerable endpoint authenticates the caller but never checks that the requested order belongs to them. Any signed-in customer can read another customer's order by supplying its id.",
    users: lab,
  };
}
