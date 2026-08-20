import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_LABEL, useCancelOrder, useOrder } from "@/hooks/useOrders";
import { statusVariant } from "@/routes/orders/index";
import { formatPrice } from "@/lib/api-client";

type OrderSearch = { placed?: boolean };

export const Route = createFileRoute("/orders/$id")({
  validateSearch: (search: Record<string, unknown>): OrderSearch =>
    search["placed"] === true || search["placed"] === "true" ? { placed: true } : {},
  head: () => ({
    meta: [
      { title: "Order details — ACME Commerce" },
      { name: "description", content: "Review the items, delivery address and payment status of your ACME Commerce order." },
      { property: "og:title", content: "Order details — ACME Commerce" },
      { property: "og:description", content: "Review your ACME Commerce order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetailPage,
});

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pending",
  succeeded: "Paid",
  failed: "Failed",
};

function OrderDetailPage() {
  return (
    <RequireSession
      title="Sign in to view this order"
      description="Orders are only visible to the account that placed them."
    >
      <OrderDetail />
    </RequireSession>
  );
}

function OrderDetail() {
  const { id } = Route.useParams();
  const { placed } = Route.useSearch();
  const { data: order, isLoading, isError } = useOrder(id, true);
  const cancelOrder = useCancelOrder();

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">Order not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This order doesn't exist, or it belongs to another account.
        </p>
        <Button className="mt-8" asChild>
          <Link to="/orders">Back to your orders</Link>
        </Button>
      </div>
    );
  }

  const address = order.shippingAddress;
  const cancellable = ["pending", "paid", "processing"].includes(order.status);

  return (
    <div className="container-page py-12">
      {placed ? (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-semibold">Thank you — your order is confirmed.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We've emailed nothing yet; this is a sandbox store. Your bag has been cleared.
            </p>
          </div>
        </div>
      ) : null}

      <p className="eyebrow">Order {order.orderNumber}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="text-4xl">{formatPrice(order.totalCents, order.currency)}</h1>
        <Badge variant={statusVariant(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Placed{" "}
        {new Date(order.createdAt).toLocaleString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-xl border border-border bg-card p-7 shadow-card">
          <h2 className="text-lg">Items</h2>
          <Separator className="my-5" />
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                <div className="text-sm">
                  {item.productSlug ? (
                    <Link
                      to="/products/$slug"
                      params={{ slug: item.productSlug }}
                      className="font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.productName}</span>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    {formatPrice(item.unitPriceCents, order.currency)} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatPrice(item.lineTotalCents, order.currency)}
                </p>
              </li>
            ))}
          </ul>

          <Separator className="my-5" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(order.subtotalCents, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>
                {order.shippingCents === 0
                  ? "Free"
                  : formatPrice(order.shippingCents, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd>{formatPrice(order.taxCents, order.currency)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(order.totalCents, order.currency)}</dd>
            </div>
          </dl>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg">Delivery address</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {address.recipientName}
              <br />
              {address.line1}
              {address.line2 ? (
                <>
                  <br />
                  {address.line2}
                </>
              ) : null}
              <br />
              {address.city}
              {address.state ? `, ${address.state}` : ""} {address.postalCode}
              <br />
              {address.country}
              {address.phone ? (
                <>
                  <br />
                  {address.phone}
                </>
              ) : null}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg">Payment</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{order.payment ? PAYMENT_LABEL[order.payment.status] : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="truncate font-mono text-xs">
                  {order.payment?.providerReference ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd>Sandbox card</dd>
              </div>
            </dl>
          </div>

          {cancellable ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate(order.id)}
            >
              {cancelOrder.isPending ? "Cancelling…" : "Cancel this order"}
            </Button>
          ) : null}
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/orders">Back to your orders</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
