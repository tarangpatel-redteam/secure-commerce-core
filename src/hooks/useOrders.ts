import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api-client";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed";

export type OrderSummary = {
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

export type OrderDetail = OrderSummary & {
  items: {
    id: string;
    productId: string | null;
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  shippingAddress: {
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
  payment: {
    status: PaymentStatus;
    provider: string;
    providerReference: string;
    amountCents: number;
    createdAt: string;
  } | null;
};

export type CheckoutResult = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  providerReference: string;
  totalCents: number;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function useOrders(enabled: boolean) {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => apiFetch<OrderSummary[]>("/orders"),
    enabled,
    retry: false,
  });
}

export function useOrder(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${orderId}`),
    enabled,
    retry: false,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { addressId: string; paymentMethod: "test_success" | "test_decline" }) =>
      apiFetch<CheckoutResult>("/orders", { method: "POST", body: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cart"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<OrderDetail>(`/orders/${orderId}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Unable to cancel that order."),
  });
}
