import { createFileRoute } from "@tanstack/react-router";

import { hasAnyRole, resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";

/**
 * Staff-only directory endpoint. It exists in this phase to prove that
 * authorization is enforced on the server: the route is reachable by anyone,
 * so the role check here — plus RLS on `profiles` — is the security boundary.
 */
export const Route = createFileRoute("/api/v1/staff/customers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Authentication required.");
        if (!hasAnyRole(caller, ["employee", "manager", "administrator"])) {
          return jsonError("forbidden", "Your role does not have access to this resource.");
        }

        const { data, error } = await caller.client
          .from("profiles")
          .select("id, email, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) {
          console.error("[api/v1/staff/customers]", error);
          return jsonError("server_error", "Unable to load the customer directory.");
        }

        return jsonOk({
          items: (data ?? []).map((row) => ({
            id: row.id,
            email: row.email,
            fullName: row.full_name,
            createdAt: row.created_at,
          })),
        });
      },
    },
  },
});
