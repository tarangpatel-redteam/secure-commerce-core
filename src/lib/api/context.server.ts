/**
 * Server-only request context for the /api/v1 REST layer.
 *
 * Two clients are available:
 *  - anonymous client: public catalogue reads, restricted by RLS to active rows
 *  - caller client: carries the caller's bearer token, so every query is
 *    executed as that user and RLS is enforced by PostgreSQL
 *
 * Authorization decisions are always made here on the server. The browser is
 * never trusted to declare its own role.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type AppRole = "customer" | "employee" | "manager" | "administrator";

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  customer: 1,
  employee: 2,
  manager: 3,
  administrator: 4,
};

export type CallerContext = {
  userId: string;
  email: string;
  roles: AppRole[];
  primaryRole: AppRole;
  client: SupabaseClient<Database>;
};

function readEnv() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend environment is not configured.");
  return { url, key };
}

function buildFetch(key: string, bearer?: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", key);
    // sb_publishable_ keys are opaque strings, not JWTs.
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
    else if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  };
}

/** Client with no session: only sees rows exposed to anonymous visitors. */
export function anonClient(): SupabaseClient<Database> {
  const { url, key } = readEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: buildFetch(key) },
  });
}

function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
}

/**
 * Resolves the caller from the Authorization header.
 * Returns null when there is no valid session (i.e. the Anonymous role).
 */
export async function resolveCaller(request: Request): Promise<CallerContext | null> {
  const token = bearerFrom(request);
  if (!token) return null;

  const { url, key } = readEnv();
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: buildFetch(key, token) },
  });

  // getUser() re-validates the token against the auth server; never trust the
  // JWT payload without verification.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: roleRows } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const effective: AppRole[] = roles.length > 0 ? roles : ["customer"];
  const primaryRole = effective.reduce((best, role) =>
    ROLE_HIERARCHY[role] > ROLE_HIERARCHY[best] ? role : best,
  );

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    roles: effective,
    primaryRole,
    client,
  };
}

export function hasAnyRole(caller: CallerContext, roles: AppRole[]): boolean {
  return caller.roles.some((role) => roles.includes(role));
}

export function atLeast(caller: CallerContext, role: AppRole): boolean {
  return ROLE_HIERARCHY[caller.primaryRole] >= ROLE_HIERARCHY[role];
}
