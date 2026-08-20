import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { AddressForm } from "@/components/site/AddressForm";
import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses, useSaveAddress } from "@/hooks/useAddresses";
import { useCart } from "@/hooks/useCart";
import { usePlaceOrder } from "@/hooks/useOrders";
import { ApiError, formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — ACME Commerce" },
      { name: "description", content: "Review your delivery details and complete your ACME Commerce order." },
      { property: "og:title", content: "Checkout — ACME Commerce" },
      { property: "og:description", content: "Complete your ACME Commerce order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <RequireSession
      title="Sign in to check out"
      description="Your bag, addresses and orders live with your account."
    >
      <CheckoutFlow />
    </RequireSession>
  );
}

/** Display-only estimate. The authoritative totals come from the server. */
const TAX_RATE = 0.085;

function CheckoutFlow() {
  const { data: cart, isLoading: cartLoading, isError: cartError } = useCart(true);
  const { data: addresses, isLoading: addressesLoading } = useAddresses(true);
  const saveAddress = useSaveAddress();
  const placeOrder = usePlaceOrder();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"test_success" | "test_decline">(
    "test_success",
  );
  const [failure, setFailure] = useState<string | null>(null);

  const addressId = useMemo(() => {
    if (selectedId) return selectedId;
    const list = addresses ?? [];
    return list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
  }, [selectedId, addresses]);

  if (cartLoading || addressesLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">We couldn't load your bag</h1>
        <p className="mt-3 text-sm text-muted-foreground">Please refresh and try again.</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">Nothing to check out</h1>
        <p className="mt-3 text-sm text-muted-foreground">Add something to your bag first.</p>
        <Button className="mt-8" asChild>
          <Link to="/products">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  const shippingCents = cart.subtotalCents >= 7500 ? 0 : 795;
  const taxCents = Math.round(cart.subtotalCents * TAX_RATE);
  const totalCents = cart.subtotalCents + shippingCents + taxCents;

  async function handlePlaceOrder() {
    if (!addressId) return;
    setFailure(null);
    try {
      const result = await placeOrder.mutateAsync({ addressId, paymentMethod });
      if (result.paymentStatus !== "succeeded") {
        setFailure(
          `Payment ${result.providerReference} was declined. No charge was made and your bag is untouched.`,
        );
        return;
      }
      await navigate({ to: "/orders/$id", params: { id: result.orderId }, search: { placed: true } });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "We couldn't complete your order.");
    }
  }

  return (
    <div className="container-page py-12">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-2 text-4xl">Complete your order</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-7 shadow-card">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <h2 className="text-lg">Delivery address</h2>
            </div>
            <Separator className="my-5" />

            {(addresses ?? []).length === 0 && !showForm ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  You don't have a saved address yet.
                </p>
                <Button className="mt-4" onClick={() => setShowForm(true)}>
                  Add an address
                </Button>
              </div>
            ) : null}

            {(addresses ?? []).length > 0 ? (
              <RadioGroup
                value={addressId ?? ""}
                onValueChange={setSelectedId}
                className="space-y-3"
              >
                {(addresses ?? []).map((address) => (
                  <Label
                    key={address.id}
                    htmlFor={`ship-${address.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 font-normal transition-colors has-[button[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem id={`ship-${address.id}`} value={address.id} className="mt-1" />
                    <span className="text-sm leading-relaxed">
                      <span className="flex items-center gap-2 font-semibold">
                        {address.label}
                        {address.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        {address.recipientName}
                        <br />
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                        <br />
                        {address.city}
                        {address.state ? `, ${address.state}` : ""} {address.postalCode},{" "}
                        {address.country}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            ) : null}

            {showForm ? (
              <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                <h3 className="mb-4 text-sm font-semibold">New address</h3>
                <AddressForm
                  submitting={saveAddress.isPending}
                  onCancel={() => setShowForm(false)}
                  onSubmit={(values) =>
                    saveAddress.mutate(
                      { values },
                      {
                        onSuccess: (created) => {
                          setSelectedId(created.id);
                          setShowForm(false);
                        },
                      },
                    )
                  }
                />
              </div>
            ) : (addresses ?? []).length > 0 ? (
              <Button variant="outline" className="mt-5" onClick={() => setShowForm(true)}>
                Add another address
              </Button>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-7 shadow-card">
            <h2 className="text-lg">Order summary</h2>
            <Separator className="my-5" />
            <ul className="divide-y divide-border">
              {cart.items.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{line.product.name}</span>
                    <span className="block text-muted-foreground">
                      {formatPrice(line.product.priceCents, cart.currency)} × {line.quantity}
                    </span>
                  </span>
                  <span className="font-semibold">
                    {formatPrice(line.lineTotalCents, cart.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-7 shadow-card">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <h2 className="text-lg">Payment</h2>
            </div>
            <Separator className="my-5" />
            <p className="text-sm text-muted-foreground">
              This store uses a sandbox payment service. No card details are collected or stored.
            </p>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) =>
                setPaymentMethod(value as "test_success" | "test_decline")
              }
              className="mt-5 space-y-3"
            >
              <Label
                htmlFor="pay-success"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 font-normal has-[button[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="pay-success" value="test_success" />
                <span className="text-sm">
                  <span className="font-semibold">Test card — approved</span>
                  <span className="block text-muted-foreground">
                    Completes the order and issues a reference.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="pay-decline"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 font-normal has-[button[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="pay-decline" value="test_decline" />
                <span className="text-sm">
                  <span className="font-semibold">Test card — declined</span>
                  <span className="block text-muted-foreground">
                    Simulates a rejected payment. Your bag is kept.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="text-lg">Totals</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(cart.subtotalCents, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{shippingCents === 0 ? "Free" : formatPrice(shippingCents, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Estimated tax</dt>
              <dd>{formatPrice(taxCents, cart.currency)}</dd>
            </div>
          </dl>
          <Separator className="my-5" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-semibold">
              {formatPrice(totalCents, cart.currency)}
            </span>
          </div>

          {failure ? (
            <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {failure}
            </p>
          ) : null}

          <Button
            className="mt-6 w-full"
            disabled={!addressId || placeOrder.isPending}
            onClick={() => void handlePlaceOrder()}
          >
            {placeOrder.isPending ? "Placing order…" : "Place order"}
          </Button>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            Final prices, tax and stock are confirmed on our servers before your order is created.
          </p>
        </aside>
      </div>
    </div>
  );
}
