import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: string;
  stockQuantity: number;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  category: { id: string; slug: string; name: string } | null;
};

export type ProductPage = {
  items: Product[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export type Category = { id: string; slug: string; name: string; description: string };

export type ProductFilters = {
  category?: string | undefined;
  search?: string | undefined;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  page?: number;
  perPage?: number;
  featured?: boolean;
};

function toSearchParams(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.perPage) params.set("perPage", String(filters.perPage));
  if (filters.featured !== undefined) params.set("featured", String(filters.featured));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => apiFetch<ProductPage>(`/products${toSearchParams(filters)}`),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiFetch<Product>(`/products/${slug}`),
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/categories", { auth: false }),
    staleTime: 5 * 60_000,
  });
}
