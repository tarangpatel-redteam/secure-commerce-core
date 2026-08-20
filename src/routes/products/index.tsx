import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useProducts } from "@/hooks/useProducts";

const searchSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).catch("newest"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/products/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop all products — ACME Commerce" },
      {
        name: "description",
        content:
          "Browse the full ACME Commerce catalogue: audio, workspace, mobility and smart home hardware with three-year cover.",
      },
      { property: "og:title", content: "Shop all products — ACME Commerce" },
      {
        property: "og:description",
        content: "The full ACME catalogue of audio, workspace, mobility and smart home hardware.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const categories = useCategories();
  const [term, setTerm] = useState(search.search ?? "");

  const query = useProducts({
    category: search.category,
    search: search.search,
    sort: search.sort,
    page: search.page,
    perPage: 12,
  });

  const activeCategory = categories.data?.find((c) => c.slug === search.category);

  return (
    <div className="container-page py-12">
      <p className="eyebrow">Catalogue</p>
      <h1 className="mt-2 text-4xl">{activeCategory ? activeCategory.name : "All products"}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        {activeCategory
          ? activeCategory.description
          : "Everything ACME currently makes, in stock and shipping from our own warehouse."}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Link
          to="/products"
          search={{ sort: search.sort, page: 1 }}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            search.category
              ? "border-border text-muted-foreground hover:text-foreground"
              : "border-primary bg-primary text-primary-foreground"
          }`}
        >
          All
        </Link>
        {categories.data?.map((category) => (
          <Link
            key={category.id}
            to="/products"
            search={{ category: category.slug, sort: search.sort, page: 1 }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              search.category === category.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({
              search: (prev) => ({ ...prev, search: term.trim() || undefined, page: 1 }),
            });
          }}
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            maxLength={80}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Select
          value={search.sort}
          onValueChange={(value) =>
            void navigate({
              search: (prev) => ({ ...prev, sort: value as typeof search.sort, page: 1 }),
            })
          }
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
            <SelectItem value="rating">Best rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {query.isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-80 rounded-xl" />
            ))
          : query.data?.items.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {!query.isLoading && query.data?.items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          No products match that search.
        </p>
      ) : null}

      {query.data && query.data.totalPages > 1 ? (
        <div className="mt-12 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={search.page <= 1}
            onClick={() =>
              void navigate({ search: (prev) => ({ ...prev, page: Math.max(1, search.page - 1) }) })
            }
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {query.data.page} of {query.data.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={search.page >= query.data.totalPages}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: search.page + 1 }) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
