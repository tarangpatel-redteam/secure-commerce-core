/**
 * Cart data access. Always executed with the caller's own Supabase client, so
 * row-level security guarantees a user can only reach their own cart rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type CartLineDto = {
  id: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    priceCents: number;
    currency: string;
    imageUrl: string | null;
    stockQuantity: number;
  };
  lineTotalCents: number;
};

export type CartDto = {
  items: CartLineDto[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
};

type Row = {
  id: string;
  quantity: number;
  products: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    price_cents: number;
    currency: string;
    image_url: string | null;
    stock_quantity: number;
  } | null;
};

export async function getCart(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CartDto> {
  const { data, error } = await client
    .from("cart_items")
    .select(
      "id, quantity, products(id, slug, name, brand, price_cents, currency, image_url, stock_quantity)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const items: CartLineDto[] = ((data ?? []) as unknown as Row[])
    .filter((row): row is Row & { products: NonNullable<Row["products"]> } => row.products !== null)
    .map((row) => ({
      id: row.id,
      quantity: row.quantity,
      product: {
        id: row.products.id,
        slug: row.products.slug,
        name: row.products.name,
        brand: row.products.brand,
        priceCents: row.products.price_cents,
        currency: row.products.currency,
        imageUrl: row.products.image_url,
        stockQuantity: row.products.stock_quantity,
      },
      lineTotalCents: row.products.price_cents * row.quantity,
    }));

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    currency: items[0]?.product.currency ?? "USD",
  };
}

export async function addToCart(
  client: SupabaseClient<Database>,
  userId: string,
  productId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "out_of_stock" }> {
  const { data: product } = await client
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, reason: "not_found" };

  const { data: existing } = await client
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, 99);
  if (product.stock_quantity < nextQuantity) return { ok: false, reason: "out_of_stock" };

  if (existing) {
    const { error } = await client
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from("cart_items")
      .insert({ user_id: userId, product_id: productId, quantity: nextQuantity });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function setCartItemQuantity(
  client: SupabaseClient<Database>,
  userId: string,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  // The user_id filter is defence in depth on top of the RLS policy.
  if (quantity === 0) {
    const { error, count } = await client
      .from("cart_items")
      .delete({ count: "exact" })
      .eq("id", itemId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }

  const { error, count } = await client
    .from("cart_items")
    .update({ quantity }, { count: "exact" })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function removeCartItem(
  client: SupabaseClient<Database>,
  userId: string,
  itemId: string,
): Promise<boolean> {
  const { error, count } = await client
    .from("cart_items")
    .delete({ count: "exact" })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
