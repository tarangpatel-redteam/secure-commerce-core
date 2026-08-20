/**
 * Catalogue data access. All queries go through the Supabase client, which
 * sends parameterised requests to PostgREST — user input is never
 * concatenated into SQL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type ProductDto = {
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

export type CategoryDto = { id: string; slug: string; name: string; description: string };

const PRODUCT_COLUMNS =
  "id, sku, slug, name, brand, short_description, description, price_cents, currency, stock_quantity, image_url, rating, review_count, is_featured, categories(id, slug, name)";

type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  categories: { id: string; slug: string; name: string } | null;
};

export function toProductDto(row: ProductRow): ProductDto {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    shortDescription: row.short_description,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    imageUrl: row.image_url,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    isFeatured: row.is_featured,
    category: row.categories,
  };
}

export type ProductQuery = {
  category?: string | undefined;
  search?: string | undefined;
  sort: "newest" | "price_asc" | "price_desc" | "rating";
  page: number;
  perPage: number;
  featured?: boolean | undefined;
};

export async function listProducts(
  client: SupabaseClient<Database>,
  query: ProductQuery,
): Promise<{ items: ProductDto[]; total: number }> {
  let categoryId: string | undefined;
  if (query.category) {
    const { data: category } = await client
      .from("categories")
      .select("id")
      .eq("slug", query.category)
      .maybeSingle();
    if (!category) return { items: [], total: 0 };
    categoryId = category.id;
  }

  let builder = client.from("products").select(PRODUCT_COLUMNS, { count: "exact" });

  if (categoryId) builder = builder.eq("category_id", categoryId);
  if (query.featured !== undefined) builder = builder.eq("is_featured", query.featured);
  if (query.search) {
    // Escaped through PostgREST's parameter encoding, not string-built SQL.
    const term = query.search.replace(/[%,()]/g, " ").trim();
    if (term) builder = builder.or(`name.ilike.%${term}%,brand.ilike.%${term}%`);
  }

  switch (query.sort) {
    case "price_asc":
      builder = builder.order("price_cents", { ascending: true });
      break;
    case "price_desc":
      builder = builder.order("price_cents", { ascending: false });
      break;
    case "rating":
      builder = builder.order("rating", { ascending: false });
      break;
    default:
      builder = builder.order("created_at", { ascending: false });
  }

  const from = (query.page - 1) * query.perPage;
  const { data, error, count } = await builder.range(from, from + query.perPage - 1);
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as unknown as ProductRow[]).map(toProductDto),
    total: count ?? 0,
  };
}

export async function getProductBySlug(
  client: SupabaseClient<Database>,
  slug: string,
): Promise<ProductDto | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProductDto(data as unknown as ProductRow) : null;
}

export async function listCategories(client: SupabaseClient<Database>): Promise<CategoryDto[]> {
  const { data, error } = await client
    .from("categories")
    .select("id, slug, name, description")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
