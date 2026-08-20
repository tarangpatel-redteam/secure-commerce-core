import { Link, createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react";
import { useState } from "react";

import { ProductArtwork } from "@/components/site/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart } from "@/hooks/useCart";
import { useProduct } from "@/hooks/useProducts";
import { useSession } from "@/hooks/useSession";
import { formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/products/$slug")({
  head: ({ params }) => {
    const readable = params.slug.replace(/-/g, " ");
    const title = `${readable.replace(/\b\w/g, (c) => c.toUpperCase())} — ACME Commerce`;
    return {
      meta: [
        { title },
        { name: "description", content: `Specifications, pricing and availability for ${readable} at ACME Commerce.` },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: `Specifications, pricing and availability for ${readable} at ACME Commerce.`,
        },
      ],
    };
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const { data: product, isLoading, isError } = useProduct(slug);
  const { session } = useSession();
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="container-page grid gap-10 py-12 md:grid-cols-2">
        <Skeleton className="aspect-4/3 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-40" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">We couldn't find that product</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have been discontinued or the link is out of date.
        </p>
        <Button className="mt-8" asChild>
          <Link to="/products">Back to the catalogue</Link>
        </Button>
      </div>
    );
  }

  const inStock = product.stockQuantity > 0;

  return (
    <div className="container-page py-12">
      <nav className="text-sm text-muted-foreground">
        <Link to="/products" className="hover:text-foreground">
          Catalogue
        </Link>
        {product.category ? (
          <>
            <span className="px-2">/</span>
            <Link
              to="/products"
              search={{ category: product.category.slug }}
              className="hover:text-foreground"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-6 grid gap-12 md:grid-cols-2">
        <div className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <ProductArtwork name={product.name} />
        </div>

        <div>
          <p className="eyebrow">{product.brand}</p>
          <h1 className="mt-2 text-4xl">{product.name}</h1>

          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-4 fill-accent text-accent" />
              {product.rating.toFixed(1)}
            </span>
            <span>{product.reviewCount} reviews</span>
            <span>SKU {product.sku}</span>
          </div>

          <p className="mt-6 text-3xl font-semibold">
            {formatPrice(product.priceCents, product.currency)}
          </p>

          <Badge variant={inStock ? "secondary" : "outline"} className="mt-3">
            {inStock ? `${product.stockQuantity} in stock` : "Currently out of stock"}
          </Badge>

          <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>

          <Separator className="my-8" />

          {session ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-md border border-input">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button
                size="lg"
                disabled={!inStock || addToCart.isPending}
                onClick={() => addToCart.mutate({ productId: product.id, quantity })}
              >
                {addToCart.isPending ? "Adding…" : "Add to bag"}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-sm font-medium">Sign in to add this to your bag</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your bag is stored with your account, so it follows you between devices.
              </p>
              <div className="mt-4 flex gap-2">
                <Button asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/register">Create an account</Link>
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Truck className="size-4 text-primary" /> Free two-day delivery over $75
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Three-year repair-first warranty
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
