import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBolaSecureGetOrder } from "@/lib/api/lab-bola.server";
import { uuidSchema } from "@/lib/api/validation";

/**
 * Secure counterpart to the vulnerable lab endpoint. Same authentication,
 * same object lookup, but with an explicit deny-by-default ownership check.
 */
export const Route = createFileRoute("/api/v1/lab/bola/secure/orders/$id/access")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid order identifier.");

        try {
          const outcome = await labBolaSecureGetOrder(id.data, caller.userId);
          if (!outcome.ok) {
            // Deny by default: a foreign object is refused, never returned.
            return outcome.reason === "forbidden"
              ? jsonError("forbidden", "You are not authorized to access that order.")
              : jsonError("not_found", "That order does not exist.");
          }

          return jsonOk({
            mode: "secure",
            owaspMapping: "API1:2023",
            authenticatedAs: { userId: caller.userId, email: caller.email },
            ownershipCheckPerformed: true,
            crossAccountAccess: false,
            order: outcome.order,
          });
        } catch (error) {
          console.error("[api/v1/lab/bola/secure/orders/:id/access POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
