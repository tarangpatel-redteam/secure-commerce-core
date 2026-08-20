import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBolaVulnerableGetOrder } from "@/lib/api/lab-bola.server";
import { uuidSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API1:2023 (BOLA).
 *
 * Authentication IS enforced (anonymous callers get 401) and the id IS
 * validated. What is missing on purpose is the object-level authorization
 * check: the handler never verifies the order belongs to the caller.
 *
 * This weakness is scoped to /api/v1/lab/bola/*. The production endpoint
 * /api/v1/orders/:id remains secure.
 */
export const Route = createFileRoute("/api/v1/lab/bola/orders/$id/access")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid order identifier.");

        try {
          // ⚠️ No `order.user_id === caller.userId` check here — that omission
          // IS the vulnerability being demonstrated.
          const order = await labBolaVulnerableGetOrder(id.data);
          if (!order) return jsonError("not_found", "That order does not exist.");

          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API1:2023",
            authenticatedAs: { userId: caller.userId, email: caller.email },
            ownershipCheckPerformed: false,
            crossAccountAccess: order.ownerUserId !== caller.userId,
            order,
          });
        } catch (error) {
          console.error("[api/v1/lab/bola/orders/:id/access POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
