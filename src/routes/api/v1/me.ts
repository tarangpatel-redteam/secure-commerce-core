import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { profileUpdateSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to view your account.");

        const { data, error } = await caller.client
          .from("profiles")
          .select("id, email, full_name, phone, marketing_opt_in, created_at")
          .eq("id", caller.userId)
          .maybeSingle();
        if (error) {
          console.error("[api/v1/me]", error);
          return jsonError("server_error", "Unable to load your account.");
        }

        return jsonOk({
          id: caller.userId,
          email: caller.email,
          fullName: data?.full_name ?? "",
          phone: data?.phone ?? "",
          marketingOptIn: data?.marketing_opt_in ?? false,
          memberSince: data?.created_at ?? null,
          roles: caller.roles,
          primaryRole: caller.primaryRole,
        });
      },

      PATCH: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to update your account.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = profileUpdateSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError("bad_request", "Please correct the highlighted fields.", parsed.error.flatten());
        }

        const { error } = await caller.client
          .from("profiles")
          .update({
            full_name: parsed.data.fullName,
            phone: parsed.data.phone || null,
            marketing_opt_in: parsed.data.marketingOptIn,
          })
          .eq("id", caller.userId);
        if (error) {
          console.error("[api/v1/me PATCH]", error);
          return jsonError("server_error", "Unable to save your changes.");
        }

        return jsonOk({ updated: true });
      },
    },
  },
});
