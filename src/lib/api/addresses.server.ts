/**
 * Address data access. Every query runs with the caller's own Supabase client,
 * so RLS guarantees a user can only reach rows they own. The owner id always
 * comes from the verified session, never from the request body.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type AddressDto = {
  id: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
};

export type AddressInput = {
  label: string;
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
};

type Row = Database["public"]["Tables"]["addresses"]["Row"];

const COLUMNS =
  "id, label, recipient_name, line1, line2, city, state, postal_code, country, phone, is_default, created_at";

function toDto(row: Row): AddressDto {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    line1: row.line1,
    line2: row.line2 ?? "",
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone ?? "",
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export async function listAddresses(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<AddressDto[]> {
  const { data, error } = await client
    .from("addresses")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toDto(row as Row));
}

async function clearOtherDefaults(
  client: SupabaseClient<Database>,
  userId: string,
  keepId?: string,
) {
  let query = client.from("addresses").update({ is_default: false }).eq("user_id", userId);
  if (keepId) query = query.neq("id", keepId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function createAddress(
  client: SupabaseClient<Database>,
  userId: string,
  input: AddressInput,
): Promise<AddressDto> {
  const existing = await listAddresses(client, userId);
  const isDefault = input.isDefault === true || existing.length === 0;

  const { data, error } = await client
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label,
      recipient_name: input.recipientName,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      state: input.state ?? "",
      postal_code: input.postalCode,
      country: input.country,
      phone: input.phone || null,
      is_default: isDefault,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  if (isDefault) await clearOtherDefaults(client, userId, (data as Row).id);
  return toDto(data as Row);
}

export async function updateAddress(
  client: SupabaseClient<Database>,
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressDto | null> {
  // The user_id filter is defence in depth on top of the RLS policy.
  const { data, error } = await client
    .from("addresses")
    .update({
      label: input.label,
      recipient_name: input.recipientName,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      state: input.state ?? "",
      postal_code: input.postalCode,
      country: input.country,
      phone: input.phone || null,
      is_default: input.isDefault === true,
    })
    .eq("id", addressId)
    .eq("user_id", userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  if (input.isDefault === true) await clearOtherDefaults(client, userId, addressId);
  return toDto(data as Row);
}

export async function deleteAddress(
  client: SupabaseClient<Database>,
  userId: string,
  addressId: string,
): Promise<boolean> {
  const { error, count } = await client
    .from("addresses")
    .delete({ count: "exact" })
    .eq("id", addressId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
