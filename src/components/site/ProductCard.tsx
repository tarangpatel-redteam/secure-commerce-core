import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/api-client";
import type { Product } from "@/hooks/useProducts";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to="/products/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-surface">
        <ProductArtwork name={product.name} />
        {product.stockQuantity === 0 ? (
          <Badge variant="secondary" className="absolute left-3 top-3">
            Out of stock
          </Badge>
        ) : product.isFeatured ? (
          <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground">Featured</Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="eyebrow">{product.brand}</p>
        <h3 className="text-base font-semibold leading-snug group-hover:underline">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-semibold">
            {formatPrice(product.priceCents, product.currency)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-accent text-accent" />
            {product.rating.toFixed(1)} ({product.reviewCount})
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Deterministic generated artwork so the catalogue looks styled without stock photos. */
export function ProductArtwork({ name }: { name: string }) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = seed % 360;
  return (
    <div
      className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
      style={{
        background: `radial-gradient(120% 100% at 25% 15%, oklch(0.93 0.05 ${hue}) 0%, oklch(0.86 0.06 ${(hue + 40) % 360}) 55%, oklch(0.78 0.05 ${(hue + 80) % 360}) 100%)`,
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="font-display text-5xl font-semibold opacity-25"
          style={{ color: `oklch(0.32 0.06 ${hue})` }}
        >
          {name.slice(0, 1)}
        </span>
      </div>
    </div>
  );
}
