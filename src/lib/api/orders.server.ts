/**
 * Order data access and the checkout workflow.
 *
 * All money is calculated in the database from stored product prices; nothing
 * the browser sends about prices, names or totals is ever trusted. Order
 * creation goes through the `place_order` SQL function so stock validation,
 * order/item/payment inserts, inventory decrement and cart clearing happen in
 * a single atomic transaction.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type OrderItemDto = {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type ShippingAddressSnapshot = {
  label?: string;
  recipientName?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string | null;
};

export type OrderSummaryDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
};

export type OrderDetailDto = OrderSummaryDto & {
  items: OrderItemDto[];
  shippingAddress: ShippingAddressSnapshot;
  payment: {
    status: PaymentStatus;
    provider: string;
    providerReference: string;
    amountCents: number;
    createdAt: string;
  } | null;
};

const ORDER_COLUMNS =
  "id, order_number, status, subtotal_cents, shipping_cents, tax_cents, total_cents, currency, created_at";

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
};

function toSummary(row: OrderRow, itemCount: number): OrderSummaryDto {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    itemCount,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

export async function listOrders(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<OrderSummaryDto[]> {
  // RLS restricts rows to the caller (or staff); the explicit filter keeps
  // customer listings scoped to their own orders regardless of role.
  const { data, error } = await client
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_items(quantity)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as (OrderRow & { order_items: { quantity: number }[] })[]).map(
    (row) => toSummary(row, row.order_items.reduce((sum, item) => sum + item.quantity, 0)),
  );
}

export async function getOrder(
  client: SupabaseClient<Database>,
  orderId: string,
): Promise<OrderDetailDto | null> {
  const { data, error } = await client
    .from("orders")
    .select(
      `${ORDER_COLUMNS}, shipping_address_snapshot,
       order_items(id, product_id, product_name_snapshot, product_slug_snapshot, unit_price_cents, quantity, line_total_cents),
       payments(status, provider, provider_reference, amount_cents, created_at)`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as OrderRow & {
    shipping_address_snapshot: ShippingAddressSnapshot;
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
      status: PaymentStatus;
      provider: string;
      provider_reference: string;
      amount_cents: number;
      created_at: string;
    }[];
  };

  const items: OrderItemDto[] = row.order_items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name_snapshot,
    productSlug: item.product_slug_snapshot,
    unitPriceCents: item.unit_price_cents,
    quantity: item.quantity,
    lineTotalCents: item.line_total_cents,
  }));

  const payment = [...row.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return {
    ...toSummary(row, items.reduce((sum, item) => sum + item.quantity, 0)),
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

export type CheckoutResult = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  providerReference: string;
  totalCents: number;
};

export type CheckoutFailure =
  | "address_not_found"
  | "cart_empty"
  | "out_of_stock"
  | "product_unavailable"
  | "invalid_payment_method";

/**
 * Runs the atomic checkout transaction. `paymentMethod` is limited to the
 * mock test methods; no card data ever reaches the server.
 */
export async function placeOrder(
  client: SupabaseClient<Database>,
  addressId: string,
  paymentMethod: "test_success" | "test_decline",
): Promise<
  | { ok: true; result: CheckoutResult }
  | { ok: false; reason: CheckoutFailure; detail?: string }
> {
  const { data, error } = await client.rpc("place_order", {
    _address_id: addressId,
    _payment_method: paymentMethod,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("ADDRESS_NOT_FOUND")) return { ok: false, reason: "address_not_found" };
    if (message.includes("CART_EMPTY")) return { ok: false, reason: "cart_empty" };
    if (message.includes("OUT_OF_STOCK")) {
      return { ok: false, reason: "out_of_stock", detail: message.split("OUT_OF_STOCK:")[1]?.trim() };
    }
    if (message.includes("PRODUCT_UNAVAILABLE")) {
      return {
        ok: false,
        reason: "product_unavailable",
        detail: message.split("PRODUCT_UNAVAILABLE:")[1]?.trim(),
      };
    }
    if (message.includes("INVALID_PAYMENT_METHOD")) {
      return { ok: false, reason: "invalid_payment_method" };
    }
    throw new Error(message);
  }

  return { ok: true, result: data as unknown as CheckoutResult };
}

export async function cancelOrder(
  client: SupabaseClient<Database>,
  orderId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_cancellable" }> {
  const { error } = await client.rpc("cancel_order", { _order_id: orderId });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("NOT_CANCELLABLE")) return { ok: false, reason: "not_cancellable" };
    if (message.includes("ORDER_NOT_FOUND")) return { ok: false, reason: "not_found" };
    throw new Error(message);
  }
  return { ok: true };
}
