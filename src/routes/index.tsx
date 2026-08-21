import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";

import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useProducts } from "@/hooks/useProducts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ACME Commerce — Considered hardware for work and travel" },
      {
        name: "description",
        content:
          "Shop ACME Commerce for audio, workspace, mobility and smart home hardware built to be repaired rather than replaced.",
      },
      { property: "og:title", content: "ACME Commerce — Considered hardware for work and travel" },
      {
        property: "og:description",
        content:
          "Audio, workspace, mobility and smart home hardware, designed in-house and built to last.",
      },
    ],
  }),
  component: HomePage,
});

const PROMISES = [
  { icon: PackageCheck, title: "Two-day delivery", copy: "On every in-stock order over $75." },
  { icon: RefreshCw, title: "60-day returns", copy: "Unused and boxed, no questions asked." },
  { icon: ShieldCheck, title: "3-year warranty", copy: "Repairs first, replacements second." },
];

function HomePage() {
  const featured = useProducts({ featured: true, perPage: 4 });
  const categories = useCategories();

  return (
    <div>
      <section className="border-b border-border bg-surface">
        <div className="container-page grid gap-10 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <p className="eyebrow">New season · 2026</p>
            <h1 className="mt-4 text-4xl leading-[1.05] md:text-6xl">
              Gear that earns its place on your desk.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              ACME builds a small catalogue of audio, workspace and travel hardware. Every product
              is designed in-house, serviceable, and covered for three years.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/products">
                  Shop the catalogue
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/products" search={{ category: "workspace" }}>
                  Explore workspace
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border shadow-lift">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(110% 90% at 20% 10%, oklch(0.9 0.06 95) 0%, oklch(0.82 0.07 60) 45%, oklch(0.5 0.08 165) 100%)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-display text-7xl font-semibold text-primary-foreground/85">
                ACME
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-6 py-12 sm:grid-cols-3">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="flex items-start gap-3">
            <promise.icon className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{promise.title}</p>
              <p className="text-sm text-muted-foreground">{promise.copy}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="container-page py-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Editors' picks</p>
            <h2 className="mt-2 text-3xl">Featured this month</h2>
          </div>
          <Link to="/products" className="text-sm font-medium underline underline-offset-4">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-80 rounded-xl" />
              ))
            : featured.data?.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>
      </section>

      <section className="container-page py-16">
        <p className="eyebrow">Browse by category</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.data?.map((category) => (
            <Link
              key={category.id}
              to="/products"
              search={{ category: category.slug }}
              className="rounded-xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <p className="font-display text-lg font-semibold">{category.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="rounded-xl border border-border bg-surface p-8">
          <p className="eyebrow">Internship assessment environment</p>
          <h2 className="mt-2 text-2xl">A controlled Web &amp; API security lab</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            This storefront doubles as a training environment. Five OWASP API Security Top 10
            scenarios are reproduced with intentionally weak endpoints kept isolated under the
            <code className="mx-1 rounded bg-secondary px-1.5 py-0.5">/api/v1/lab/*</code>
            namespace, each paired with a secure implementation. Catalogue, cart, checkout and order
            data used here is synthetic; no real payment or personal data is involved.
          </p>
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link to="/labs">
                Open the lab index
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
