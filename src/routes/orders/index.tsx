import { Link, createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_LABEL, type OrderStatus, useOrders } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Your orders — ACME Commerce" },
      { name: "description", content: "Track the status of every ACME Commerce order you have placed." },
      { property: "og:title", content: "Your orders — ACME Commerce" },
      { property: "og:description", content: "Track your ACME Commerce orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

export function statusVariant(status: OrderStatus): "default" | "secondary" | "destructive" {
  if (status === "cancelled") return "destructive";
  if (status === "delivered" || status === "shipped") return "default";
  return "secondary";
}

function OrdersPage() {
  return (
    <RequireSession
      title="Sign in to see your orders"
      description="Your order history is tied to your ACME Commerce account."
    >
      <OrdersList />
    </RequireSession>
  );
}

function OrdersList() {
  const { data: orders, isLoading, isError } = useOrders(true);

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-8 h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">We couldn't load your orders</h1>
        <p className="mt-3 text-sm text-muted-foreground">Please refresh and try again.</p>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container-page py-24 text-center">
        <PackageSearch className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-3xl">No orders yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          When you place an order it will appear here with its full history.
        </p>
        <Button className="mt-8" asChild>
          <Link to="/products">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <p className="eyebrow">Orders</p>
      <h1 className="mt-2 text-4xl">Your order history</h1>

      <ul className="mt-10 space-y-4">
        {orders.map((order) => (
          <li
            key={order.id}
            className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="min-w-40">
              <p className="eyebrow">Order</p>
              <p className="font-semibold">{order.orderNumber}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <Badge variant={statusVariant(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            <p className="text-sm text-muted-foreground">
              {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            </p>
            <p className="ml-auto text-lg font-semibold">
              {formatPrice(order.totalCents, order.currency)}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/orders/$id" params={{ id: order.id }}>
                View details
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
