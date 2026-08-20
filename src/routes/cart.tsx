import { Link, createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";

import { ProductArtwork } from "@/components/site/ProductCard";
import { RequireSession } from "@/components/site/RequireSession";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/hooks/useCart";
import { formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your bag — ACME Commerce" },
      { name: "description", content: "Review the items in your ACME Commerce bag." },
      { property: "og:title", content: "Your bag — ACME Commerce" },
      { property: "og:description", content: "Review the items in your ACME Commerce bag." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  return (
    <RequireSession
      title="Your bag is waiting"
      description="Sign in to see the items saved to your account."
    >
      <CartContents />
    </RequireSession>
  );
}

function CartContents() {
  const { data: cart, isLoading } = useCart(true);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-8 h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">Your bag is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Once you add something it will stay here, on any device.
        </p>
        <Button className="mt-8" asChild>
          <Link to="/products">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  const shippingCents = cart.subtotalCents >= 7500 ? 0 : 795;

  return (
    <div className="container-page py-12">
      <p className="eyebrow">Your bag</p>
      <h1 className="mt-2 text-4xl">
        {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
      </h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {cart.items.map((line) => (
            <li key={line.id} className="flex gap-4 p-5">
              <Link
                to="/products/$slug"
                params={{ slug: line.product.slug }}
                className="group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
              >
                <ProductArtwork name={line.product.name} />
              </Link>

              <div className="flex flex-1 flex-col">
                <p className="eyebrow">{line.product.brand}</p>
                <Link
                  to="/products/$slug"
                  params={{ slug: line.product.slug }}
                  className="text-base font-semibold hover:underline"
                >
                  {line.product.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPrice(line.product.priceCents, line.product.currency)} each
                </p>

                <div className="mt-auto flex items-center gap-3 pt-3">
                  <div className="flex items-center rounded-md border border-input">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Decrease quantity"
                      disabled={updateItem.isPending}
                      onClick={() =>
                        updateItem.mutate({
                          itemId: line.id,
                          quantity: Math.max(0, line.quantity - 1),
                        })
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-9 text-center text-sm font-medium">{line.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Increase quantity"
                      disabled={
                        updateItem.isPending || line.quantity >= line.product.stockQuantity
                      }
                      onClick={() =>
                        updateItem.mutate({ itemId: line.id, quantity: line.quantity + 1 })
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => removeItem.mutate(line.id)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>

              <p className="text-base font-semibold">
                {formatPrice(line.lineTotalCents, line.product.currency)}
              </p>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(cart.subtotalCents, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{shippingCents === 0 ? "Free" : formatPrice(shippingCents, cart.currency)}</dd>
            </div>
          </dl>
          <Separator className="my-5" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Estimated total</span>
            <span className="text-xl font-semibold">
              {formatPrice(cart.subtotalCents + shippingCents, cart.currency)}
            </span>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Taxes are calculated at checkout. Checkout is not part of this release.
          </p>
          <Button variant="outline" className="mt-5 w-full" asChild>
            <Link to="/products">Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
